// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE CON TUS CREDENCIALES
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Tus credenciales reales de Mabe San Luis
const firebaseConfig = {
    apiKey: "AIzaSyBBm9IIA5MEPir2N6WHFEexkTY2p0Igs3w",
    authDomain: "mabe-3d-print.firebaseapp.com",
    databaseURL: "https://mabe-3d-print-default-rtdb.firebaseio.com",
    projectId: "mabe-3d-print",
    storageBucket: "mabe-3d-print.firebasestorage.app",
    messagingSenderId: "733822984958",
    appId: "1:733822984958:web:92c16288073b1dd4b8bbaf"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Exponer funciones para que el HTML pueda ejecutarlas
window.switchTab = switchTab;
window.guardarPedido = guardarPedido;
window.consultarPedido = consultarPedido;
window.cerrarModal = cerrarModal;

// ==========================================
// 2. NAVEGACIÓN ENTRE PESTAÑAS (Tabs)
// ==========================================
function switchTab(tab) {
    const tabNuevo = document.getElementById('section-nuevo');
    const tabBuscar = document.getElementById('section-buscar');
    const btnNuevo = document.getElementById('btn-tab-nuevo');
    const btnBuscar = document.getElementById('btn-tab-buscar');

    if (tab === 'nuevo') {
        tabNuevo.classList.add('active');
        tabBuscar.classList.remove('active');
        btnNuevo.classList.add('active');
        btnBuscar.classList.remove('active');
    } else {
        tabNuevo.classList.remove('active');
        tabBuscar.classList.add('active');
        btnNuevo.classList.remove('active');
        btnBuscar.classList.add('active');
    }
}

// ==========================================
// 3. GENERADOR DE CÓDIGO ÚNICO DE TICKET
// ==========================================
function generarCodigoTicket(area) {
    const numeroAleatorio = Math.floor(1000 + Math.random() * 9000);
    return `#${area}-${numeroAleatorio}`;
}

// ==========================================
// 4. GUARDAR PEDIDO EN FIREBASE
// ==========================================
async function guardarPedido(event) {
    event.preventDefault();

    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('email').value.trim();
    const area = document.getElementById('area').value;
    const tipoSolicitud = document.getElementById('tipoSolicitud').value;
    const prioridad = document.getElementById('prioridad').value;
    const linkArchivo = document.getElementById('linkArchivo').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();

    const codigoTicket = generarCodigoTicket(area);
    const fechaActual = new Date().toISOString();

    const nuevoPedido = {
        codigo: codigoTicket,
        requisitor: nombre,
        email: email,
        area: area,
        tipoSolicitud: tipoSolicitud,
        prioridad: prioridad,
        linkArchivo: linkArchivo || "N/A",
        descripcion: descripcion,
        estado: "Pendiente de Revisión",
        motivoRechazo: "",
        fechaCreacion: fechaActual
    };

    try {
        // Guarda en Firebase en la ruta: /pedidos/CODIGO_SIN_HASHTAG
        await set(ref(db, 'pedidos/' + codigoTicket.replace('#', '')), nuevoPedido);

        // Mostrar Modal de confirmación
        document.getElementById('ticket-codigo').innerText = codigoTicket;
        document.getElementById('modal-exito').classList.remove('hidden');
        document.getElementById('form-pedido').reset();

    } catch (error) {
        console.error("Error al guardar en Firebase:", error);
        alert("Ocurrió un error al registrar la solicitud: " + error.message);
    }
}

// ==========================================
// 5. CONSULTAR ESTADO DE PEDIDO
// ==========================================
async function consultarPedido() {
    let codigo = document.getElementById('input-codigo').value.trim().toUpperCase();
    
    if (!codigo) {
        alert("Por favor ingresa un código de ticket válido.");
        return;
    }

    const codigoLimpio = codigo.replace('#', '');
    const contenedorResultado = document.getElementById('resultado-busqueda');

    contenedorResultado.innerHTML = `<p style="text-align:center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Buscando pedido...</p>`;
    contenedorResultado.classList.remove('hidden');

    try {
        const dbRef = ref(db);
        const snapshot = await get(child(dbRef, `pedidos/${codigoLimpio}`));

        if (snapshot.exists()) {
            const pedido = snapshot.val();
            renderizarTarjetaEstado(pedido, contenedorResultado);
        } else {
            contenedorResultado.innerHTML = `
                <div style="background: rgba(255, 77, 77, 0.1); border: 1px solid var(--accent-red); padding: 15px; border-radius: 8px; text-align: center;">
                    <i class="fa-solid fa-circle-xmark" style="color: var(--accent-red); font-size: 1.5rem; margin-bottom: 5px;"></i>
                    <p style="color: var(--accent-red); font-weight: bold;">No se encontró ningún pedido con el código #${codigoLimpio}</p>
                    <p style="font-size:0.8rem; color: var(--text-muted);">Verifica que esté bien escrito (Ej: #CAL-8492).</p>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error al consultar:", error);
        alert("Error al conectar con la base de datos.");
    }
}

function renderizarTarjetaEstado(pedido, contenedor) {
    let colorEstado = "var(--accent-yellow)";
    let iconoEstado = "fa-clock";

    if (pedido.estado === "Aprobado / En Cola") {
        colorEstado = "var(--primary)";
        iconoEstado = "fa-list-check";
    } else if (pedido.estado === "Imprimiendo") {
        colorEstado = "var(--primary)";
        iconoEstado = "fa-cube fa-spin";
    } else if (pedido.estado === "Listo para Retiro") {
        colorEstado = "var(--accent-green)";
        iconoEstado = "fa-circle-check";
    } else if (pedido.estado === "Rechazado") {
        colorEstado = "var(--accent-red)";
        iconoEstado = "fa-circle-xmark";
    }

    let detalleRechazoHTML = "";
    if (pedido.estado === "Rechazado" && pedido.motivoRechazo) {
        detalleRechazoHTML = `
            <div style="background: rgba(255,77,77,0.15); border-left: 3px solid var(--accent-red); padding: 10px; margin-top: 10px; font-size: 0.85rem; border-radius: 4px;">
                <strong style="color: var(--accent-red);">Motivo:</strong> ${pedido.motivoRechazo}
            </div>
        `;
    }

    contenedor.innerHTML = `
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; margin-bottom: 15px;">
                <span style="font-weight: bold; font-size: 1.1rem; color: var(--primary);">${pedido.codigo}</span>
                <span style="background: ${colorEstado}22; color: ${colorEstado}; border: 1px solid ${colorEstado}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 5px;">
                    <i class="fa-solid ${iconoEstado}"></i> ${pedido.estado}
                </span>
            </div>
            <p style="font-size: 0.9rem; margin-bottom: 5px;"><strong>Requisitor:</strong> ${pedido.requisitor} (${pedido.area})</p>
            <p style="font-size: 0.9rem; margin-bottom: 5px;"><strong>Tipo:</strong> ${pedido.tipoSolicitud}</p>
            <p style="font-size: 0.9rem; margin-bottom: 5px;"><strong>Descripción:</strong> ${pedido.descripcion}</p>
            ${detalleRechazoHTML}
        </div>
    `;
}

function cerrarModal() {
    document.getElementById('modal-exito').classList.add('hidden');
}