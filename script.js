// Portal de Encomiendas Lapticon
// JavaScript puro con Fetch API, autenticación de Firebase y consumo del backend.

const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyAuh64b_I2OtC7KYuubCVx9plEe2pojp2M';
const BACKEND_BASE_URL = 'https://lapticon-backend-ed.onrender.com';

const state = {
  idToken: '',
  localId: '',
  ciudadOrigen: [],
  ciudadDestino: []
};

const loginView = document.getElementById('loginView');
const portalView = document.getElementById('portalView');
const loginForm = document.getElementById('loginForm');
const encomiendaForm = document.getElementById('encomiendaForm');
const loginButton = document.getElementById('loginButton');
const registerButton = document.getElementById('registerButton');
const refreshEncomiendasButton = document.getElementById('refreshEncomiendasButton');
const logoutButton = document.getElementById('logoutButton');
const origenSelect = document.getElementById('origenSelect');
const destinoSelect = document.getElementById('destinoSelect');
const encomiendasTableBody = document.getElementById('encomiendasTableBody');

const loginMessage = document.getElementById('loginMessage');
const encomiendaMessage = document.getElementById('encomiendaMessage');
const encomiendasMessage = document.getElementById('encomiendasMessage');

// Inicialización del portal.
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  showLoginView();
});

function bindEvents() {
  loginForm.addEventListener('submit', iniciarSesion);
  encomiendaForm.addEventListener('submit', registrarEncomienda);
  refreshEncomiendasButton.addEventListener('click', cargarEncomiendas);
  logoutButton.addEventListener('click', cerrarSesion);
}

function showLoginView() {
  loginView.classList.remove('hidden');
  portalView.classList.add('hidden');
}

function showPortalView() {
  loginView.classList.add('hidden');
  portalView.classList.remove('hidden');
}

function setMessage(element, text, type = 'info') {
  if (!element) return;

  element.textContent = text || '';
  element.className = 'message visible ' + type;
}

function clearMessage(element) {
  if (!element) return;
  element.textContent = '';
  element.className = 'message';
}

function setLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? text : text;
}

function getInputValue(elementId) {
  const element = document.getElementById(elementId);
  return element ? element.value.trim() : '';
}

function validarFormularioLogin() {
  const email = getInputValue('email');
  const password = getInputValue('password');

  if (!email || !password) {
    setMessage(loginMessage, 'Debes ingresar correo y contraseña.', 'error');
    return false;
  }

  return true;
}

async function iniciarSesion(event) {
  event.preventDefault();

  if (!validarFormularioLogin()) {
    return;
  }

  const email = getInputValue('email');
  const password = getInputValue('password');

  setLoading(loginButton, true, 'Iniciando sesión...');
  clearMessage(loginMessage);

  try {
    const data = await requestJson(FIREBASE_AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    }, true);

    state.idToken = data.idToken || '';
    state.localId = data.localId || '';

    if (!state.idToken || !state.localId) {
      throw new Error('La respuesta de autenticación no incluye el token requerido.');
    }

    setMessage(loginMessage, 'Inicio de sesión correcto.', 'success');
    showPortalView();
    clearMessage(loginMessage);

    await cargarCiudades();
    await cargarEncomiendas();
  } catch (error) {
    setMessage(loginMessage, manejarError(error, 'No se pudo iniciar sesión. Revisa tus credenciales o la conexión.'), 'error');
  } finally {
    setLoading(loginButton, false, 'Iniciar sesión');
  }
}

function cerrarSesion() {
  state.idToken = '';
  state.localId = '';
  loginForm.reset();
  encomiendaForm.reset();
  clearMessage(loginMessage);
  clearMessage(encomiendaMessage);
  clearMessage(encomiendasMessage);
  origenSelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
  destinoSelect.innerHTML = '<option value="">Selecciona una ciudad</option>';
  encomiendasTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">Cargando encomiendas...</td></tr>';
  showLoginView();
}

async function cargarCiudades() {
  if (!state.idToken) {
    return;
  }

  try {
    const [paisesResponse, ciudadesResponse] = await Promise.all([
      requestJson(`${BACKEND_BASE_URL}/api/ciudades/paises`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }),
      requestJson(`${BACKEND_BASE_URL}/api/ciudades/ciudades`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    ]);

    const paises = normalizarColeccion(paisesResponse);
    const ciudades = normalizarColeccion(ciudadesResponse);

    state.ciudadOrigen = ciudades;
    state.ciudadDestino = ciudades;

    poblarSelect(origenSelect, ciudades, 'Selecciona una ciudad');
    poblarSelect(destinoSelect, ciudades, 'Selecciona una ciudad');

    if (!ciudades.length) {
      setMessage(encomiendasMessage, 'No se pudieron cargar las ciudades del backend.', 'info');
    }
  } catch (error) {
    setMessage(encomiendasMessage, manejarError(error, 'No fue posible cargar las ciudades desde el backend.'), 'error');
  }
}

function poblarSelect(selectElement, items, placeholderText) {
  if (!selectElement) return;

  const options = [{ value: '', label: placeholderText }];

  items.forEach((item) => {
    const value = obtenerValor(item, ['id', '_id', 'codigo', 'codigoCiudad', 'ciudadId', 'idCiudad']);
    const label = obtenerTexto(item, ['nombre', 'name', 'ciudad', 'label', 'titulo']);

    if (value !== '' && label !== '') {
      options.push({ value: String(value), label: String(label) });
    }
  });

  selectElement.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
}

function normalizarColeccion(datos) {
  if (Array.isArray(datos)) {
    return datos.filter((item) => item && typeof item === 'object');
  }

  if (!datos || typeof datos !== 'object') {
    return [];
  }

  const claves = ['data', 'result', 'items', 'results', 'ciudades', 'paises', 'encomiendas'];

  for (const clave of claves) {
    if (Array.isArray(datos[clave])) {
      return datos[clave].filter((item) => item && typeof item === 'object');
    }
  }

  const valores = Object.values(datos);
  const arrays = valores.filter((value) => Array.isArray(value));

  if (arrays.length) {
    return arrays[0].filter((item) => item && typeof item === 'object');
  }

  return [];
}

function obtenerTexto(objeto, claves) {
  if (!objeto || typeof objeto !== 'object') {
    return '';
  }

  for (const clave of claves) {
    if (objeto[clave] !== undefined && objeto[clave] !== null && objeto[clave] !== '') {
      return String(objeto[clave]);
    }
  }

  const valores = Object.values(objeto);
  for (const valor of valores) {
    if (typeof valor === 'string' && valor.trim()) {
      return valor.trim();
    }
  }

  return '';
}

function obtenerValor(objeto, claves) {
  if (!objeto || typeof objeto !== 'object') {
    return '';
  }

  for (const clave of claves) {
    if (objeto[clave] !== undefined && objeto[clave] !== null && objeto[clave] !== '') {
      return objeto[clave];
    }
  }

  return '';
}

async function registrarEncomienda(event) {
  event.preventDefault();

  const origen = origenSelect.value;
  const destino = destinoSelect.value;
  const valor = document.getElementById('valorInput').value.trim();
  const moneda = document.getElementById('monedaSelect').value;
  const observaciones = document.getElementById('observacionesInput').value.trim();

  if (!origen || !destino || !valor || !moneda || !observaciones) {
    setMessage(encomiendaMessage, 'Todos los campos son obligatorios antes de registrar la encomienda.', 'error');
    return;
  }

  const payload = {
    ciudadOrigen: origen,
    ciudad_origen: origen,
    origen: origen,
    ciudadDestino: destino,
    ciudad_destino: destino,
    destino: destino,
    valor: Number(valor),
    moneda,
    observaciones,
    observacion: observaciones,
    estado: 'pendiente'
  };

  setLoading(registerButton, true, 'Registrando...');
  clearMessage(encomiendaMessage);

  try {
    await requestJson(`${BACKEND_BASE_URL}/api/encomiendas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.idToken}`
      },
      body: JSON.stringify(payload)
    });

    setMessage(encomiendaMessage, 'La encomienda se registró correctamente.', 'success');
    encomiendaForm.reset();
    await cargarEncomiendas();
  } catch (error) {
    setMessage(encomiendaMessage, manejarError(error, 'No se pudo registrar la encomienda.'), 'error');
  } finally {
    setLoading(registerButton, false, 'Registrar encomienda');
  }
}

async function cargarEncomiendas() {
  if (!state.idToken) {
    return;
  }

  clearMessage(encomiendasMessage);

  try {
    const datos = await requestJson(`${BACKEND_BASE_URL}/api/encomiendas`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${state.idToken}`
      }
    });

    const encomiendas = normalizarColeccion(datos);

    if (!encomiendas.length) {
      encomiendasTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">No hay encomiendas registradas.</td></tr>';
      return;
    }

    encomiendasTableBody.innerHTML = encomiendas
      .map((item) => {
        const origen = obtenerTexto(item, ['ciudadOrigen', 'ciudad_origen', 'origen', 'ciudadOrigenNombre', 'nombreOrigen', 'origenNombre']);
        const destino = obtenerTexto(item, ['ciudadDestino', 'ciudad_destino', 'destino', 'ciudadDestinoNombre', 'nombreDestino', 'destinoNombre']);
        const estado = obtenerTexto(item, ['estado', 'status']);
        const valor = obtenerTexto(item, ['valor', 'monto', 'total', 'precio', 'valorEncomienda']);
        const moneda = obtenerTexto(item, ['moneda', 'currency']);
        const id = obtenerValor(item, ['id', '_id', 'encomiendaId', 'codigo', 'uuid']);

        const estadoClass = normalizarEstado(estado, 'pendiente');

        const boton = estado && String(estado).toLowerCase() === 'cancelada' ?
          '<span class="badge cancelled">Cancelada</span>' :
          `<button class="cancel-button" data-id="${id}" type="button">Cancelar</button>`;

        return `
          <tr>
            <td>${origen || 'Sin dato'}</td>
            <td>${destino || 'Sin dato'}</td>
            <td><span class="badge ${estadoClass}">${estado || 'Pendiente'}</span></td>
            <td>${valor || '0'}</td>
            <td>${moneda || 'USD'}</td>
            <td>${boton}</td>
          </tr>
        `;
      })
      .join('');

    encomiendasTableBody.querySelectorAll('.cancel-button').forEach((button) => {
      button.addEventListener('click', async () => {
        const id = button.dataset.id;
        if (!id) {
          setMessage(encomiendasMessage, 'No se pudo identificar la encomienda para cancelar.', 'error');
          return;
        }

        button.disabled = true;
        button.textContent = 'Cancelando...';

        try {
          await requestJson(`${BACKEND_BASE_URL}/api/encomiendas/${id}/estado`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${state.idToken}`
            },
            body: JSON.stringify({ estado: 'cancelada' })
          });

          setMessage(encomiendasMessage, 'Encomienda cancelada correctamente.', 'success');
          await cargarEncomiendas();
        } catch (error) {
          setMessage(encomiendasMessage, manejarError(error, 'No se pudo cancelar la encomienda.'), 'error');
          button.disabled = false;
          button.textContent = 'Cancelar';
        }
      });
    });
  } catch (error) {
    encomiendasTableBody.innerHTML = '<tr><td colspan="6" class="table-empty">No se pudo cargar el historial de encomiendas.</td></tr>';
    setMessage(encomiendasMessage, manejarError(error, 'No fue posible obtener las encomiendas del backend.'), 'error');
  }
}

function normalizarEstado(estado, fallback = 'pendiente') {
  const valor = String(estado || fallback).toLowerCase();

  if (valor.includes('cancel')) {
    return 'cancelled';
  }

  if (valor.includes('entreg') || valor.includes('complet') || valor.includes('cerr')) {
    return 'success';
  }

  return 'pending';
}

async function requestJson(url, options = {}, silentError = false) {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const payload = await response.text();
      let mensaje = 'La petición falló.';

      try {
        const json = JSON.parse(payload);
        mensaje = obtenerMensajeError(json) || mensaje;
      } catch (error) {
        mensaje = payload || mensaje;
      }

      throw new Error(mensaje);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    return await response.text();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de conexión';

    if (!silentError) {
      throw new Error(message);
    }

    throw new Error(message);
  }
}

function obtenerMensajeError(payload) {
  if (!payload) {
    return '';
  }

  if (payload.message) {
    return payload.message;
  }

  if (payload.error && typeof payload.error === 'object') {
    if (payload.error.message) {
      return payload.error.message;
    }
    if (payload.error.errors && payload.error.errors.length) {
      return payload.error.errors[0].message || '';
    }
  }

  return '';
}

function manejarError(error, mensajeFallback) {
  if (!error) {
    return mensajeFallback;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error.message) {
    return error.message;
  }

  return mensajeFallback;
}
