import requests
from bs4 import BeautifulSoup
import urllib3
import ssl
import json
import sys
import unicodedata

# --- PARCHE SSL PARA SERVIDORES ANTIGUOS (FCCA) ---
class OldSSLAdapter(requests.adapters.HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        context.set_ciphers('DEFAULT:@SECLEVEL=1')
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        kwargs['ssl_context'] = context
        return super(OldSSLAdapter, self).init_poolmanager(*args, **kwargs)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

URL_HORARIOS = "https://www.fcca.umich.mx/Horarios.php"

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': URL_HORARIOS
}

# Etiquetas esperadas en la tabla de "Sección" (sin acentos, minusculas) -> nombre bonito de salida
LABELS_MAP = {
    "semestre": "Semestre",
    "seccion": "Seccion",
    "salon": "Salon",
    "turno": "Turno",
    "licenciatura": "Licenciatura",
    "modalidad": "Modalidad",
    "periodo": "Periodo",
}


def quitar_acentos(txt):
    txt = unicodedata.normalize('NFKD', txt)
    return ''.join(c for c in txt if not unicodedata.combining(c))


def normalizar(txt):
    return quitar_acentos(txt).strip().lower()


def _cuenta_etiquetas_conocidas(celdas):
    """Cuenta cuantas celdas de una fila coinciden con una etiqueta conocida."""
    total = 0
    for c in celdas:
        if normalizar(c.get_text(strip=True)) in LABELS_MAP:
            total += 1
    return total


def extraer_info_general(soup):
    """
    Busca en todas las tablas una fila que contenga las etiquetas
    Semestre / Seccion / Salon / Turno / Licenciatura / Modalidad / Periodo,
    y luego avanza fila por fila hasta encontrar la primera fila que YA NO
    se parezca a una fila de etiquetas (para saltar filas decorativas o
    encabezados duplicados) y la toma como la fila de valores.
    """
    for tabla in soup.find_all('table'):
        filas = tabla.find_all('tr')
        for idx, fila in enumerate(filas):
            celdas = fila.find_all(['th', 'td'])
            etiquetas_norm = [normalizar(c.get_text(strip=True)) for c in celdas]

            posiciones = {}
            for i, et in enumerate(etiquetas_norm):
                if et in LABELS_MAP:
                    posiciones[i] = LABELS_MAP[et]

            if len(posiciones) < 4:
                continue

            # Encontramos la fila de etiquetas. Ahora buscamos la fila de
            # valores real, saltando cualquier fila que siga pareciendo
            # una fila de etiquetas (duplicada/decorativa).
            j = idx + 1
            fila_valores = None
            while j < len(filas):
                candidata = filas[j]
                celdas_candidata = candidata.find_all(['th', 'td'])
                if not celdas_candidata:
                    j += 1
                    continue
                # Si la mayoria de sus celdas siguen siendo etiquetas conocidas,
                # no es la fila de valores todavia: seguimos avanzando.
                if _cuenta_etiquetas_conocidas(celdas_candidata) >= 2:
                    j += 1
                    continue
                fila_valores = candidata
                break

            if fila_valores is None:
                continue

            celdas_valores = fila_valores.find_all(['th', 'td'])
            labels_ordenados = [nombre for i, nombre in sorted(posiciones.items())]
            values_textos = [c.get_text(strip=True) for c in celdas_valores]

            # Si hay menos valores que etiquetas, asumimos que lo que falta
            # es al inicio (ej. el semestre, que ya conocemos por parametro)
            # y alineamos las etiquetas restantes contra el final.
            if len(values_textos) < len(labels_ordenados):
                labels_ordenados = labels_ordenados[-len(values_textos):]
            elif len(values_textos) > len(labels_ordenados):
                values_textos = values_textos[:len(labels_ordenados)]

            info = {}
            for nombre, valor in zip(labels_ordenados, values_textos):
                if normalizar(valor) not in LABELS_MAP:
                    info[nombre] = valor
            if info:
                return info
    return {}


def extraer_horario_detalle(soup):
    """
    Misma logica de extraccion que el script original: recorre todas las
    tablas buscando filas de materias (con al menos 10 celdas y la materia
    en negritas), y arma la lista de horarios por dia.
    """
    horario = []
    for tabla in soup.find_all('table'):
        for fila in tabla.find_all('tr'):
            celdas = fila.find_all('td')
            if len(celdas) >= 10:
                mat_td = celdas[1]
                if mat_td.find('strong') or mat_td.find('b'):
                    materia = mat_td.get_text(strip=True)

                    def get_hora(td):
                        txt = td.get_text(separator=' - ', strip=True)
                        return txt if txt else None

                    clase = {
                        "Materia": materia,
                        "Lunes": get_hora(celdas[4]),
                        "Martes": get_hora(celdas[5]),
                        "Miercoles": get_hora(celdas[6]),
                        "Jueves": get_hora(celdas[7]),
                        "Viernes": get_hora(celdas[8]),
                        "Sabado": get_hora(celdas[9])
                    }
                    clase_limpia = {k: v for k, v in clase.items() if v is not None}
                    horario.append(clase_limpia)
    return horario


def obtener_seccion(semestre, seccion):
    """
    semestre: numero de semestre, ej. 7
    seccion: numero de seccion, ej. 26  (se compara como "Sem X - Secc YY")
    Regresa un diccionario listo para volcar a JSON.
    """
    session = requests.Session()
    session.mount('https://', OldSSLAdapter())

    print("1. Conectando al servidor para obtener el periodo y desbloquear secciones...")
    res_get = session.get(URL_HORARIOS, headers=headers, verify=False)
    soup_get = BeautifulSoup(res_get.text, 'html.parser')

    select_periodo = soup_get.find('select')
    name_periodo = select_periodo.get('name', 'ID_Periodo') if select_periodo else 'ID_Periodo'

    val_periodo = None
    if select_periodo:
        for opt in select_periodo.find_all('option'):
            if opt.get('value'):
                val_periodo = opt.get('value')
                break

    btn = soup_get.find('input', type='submit')
    name_btn = btn.get('name', 'Consultar') if btn and btn.get('name') else 'Consultar'
    val_btn = btn.get('value', 'Consultar') if btn else 'Consultar'

    payload_inicial = {name_periodo: val_periodo, name_btn: val_btn}
    res_post1 = session.post(URL_HORARIOS, data=payload_inicial, headers=headers, verify=False)
    soup_post1 = BeautifulSoup(res_post1.text, 'html.parser')

    select_secciones = None
    for s in soup_post1.find_all('select'):
        if "Sem" in s.get_text() or "Secc" in s.get_text():
            select_secciones = s
            break

    if not select_secciones:
        return {"error": "El servidor no devolvio las secciones. Revisa si la pagina esta activa."}

    # Buscar la opcion que coincide con el semestre y la seccion pedidos
    texto_buscado = f"Sem {int(semestre)} - Secc {int(seccion):02d}"
    valor_seccion = None
    opciones_disponibles = []
    for opt in select_secciones.find_all('option'):
        v = opt.get('value')
        t = opt.get_text(strip=True)
        if v and v.strip() != "":
            opciones_disponibles.append(t)
            if t.strip().lower() == texto_buscado.lower():
                valor_seccion = v

    if not valor_seccion:
        return {
            "error": f"No se encontro '{texto_buscado}' entre las secciones disponibles.",
            "secciones_disponibles": opciones_disponibles
        }

    print(f"2. Descargando datos de: {texto_buscado} ...")
    payload_final = {'ID_Seccion': valor_seccion}
    res_final = session.post(URL_HORARIOS, data=payload_final, headers=headers, verify=False, timeout=15)
    soup_final = BeautifulSoup(res_final.text, 'html.parser')

    info_general = extraer_info_general(soup_final)
    info_general["Semestre"] = str(int(semestre))
    horario = extraer_horario_detalle(soup_final)

    resultado = {}
    resultado.update(info_general)
    resultado["Horario"] = horario

    return resultado


if __name__ == "__main__":
    if len(sys.argv) >= 3:
        semestre_in = sys.argv[1]
        seccion_in = sys.argv[2]
    else:
        semestre_in = input("Semestre (ej. 7): ").strip()
        seccion_in = input("Seccion (ej. 26): ").strip()

    resultado = obtener_seccion(semestre_in, seccion_in)

    nombre_archivo = f"seccion_sem{semestre_in}_secc{seccion_in}.json"
    with open(nombre_archivo, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=4)

    print(json.dumps(resultado, ensure_ascii=False, indent=4))
    print(f"\n✅ Guardado en {nombre_archivo}")
