// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBBm9IIA5MEPir2N6WHFEexkTY2p0Igs3w",
    authDomain: "mabe-3d-print.firebaseapp.com",
    databaseURL: "https://mabe-3d-print-default-rtdb.firebaseio.com",
    projectId: "mabe-3d-print",
    storageBucket: "mabe-3d-print.firebasestorage.app",
    messagingSenderId: "733822984958",
    appId: "1:733822984958:web:92c16288073b1dd4b8bbaf"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let todosLosPedidos = [];

// Exponer funciones globales
window.cambiarEstado = cambiarEstado;
window.abrirModalRechazo = abrirModalRechazo;
window.cerrarModalRechazo = cerrarModalRechazo;
window.confirmarRechazo = confirmarRechazo;
window.filtrarPedidos = filtrarPedidos;

// ==========================================
// 2. ESCUCHA EN TIEMPO REAL (Realtime DB)
// ==========================================
const pedidosRef = ref(db, 'pedidos');

onValue(pedidosRef, (snapshot) => {
    const data = snapshot.val();
    todosLosPedidos = [];

    if (data) {
        Object.keys(data).forEach(key => {
            todosLosPedidos.push(data[key]);
        });
        // Ordenar por fecha (más recientes primero)
        todosLosPedidos.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
    }

    actualizarKPIs();
    filtrarPedidos();
});

// ==========================================
// 3. ACTUALIZACIÓN DE INDICADORES (KPIs)
// ==========================================
function actualizarKPIs() {
    let pendientes = 0;
    let imprimiendo = 0;
    let listos = 0;
    let urgentes = 0;

    todosLosPedidos.forEach(p => {
        if (p.estado === "Pendiente de Revisión") pendientes++;
        if (p.estado === "Imprimiendo") imprimiendo++;
        if (p.estado === "Listo para Retiro") listos++;
        if (p.prioridad === "Alta" && p.estado !== "Listo para Retiro" && p.estado !== "Rechazado") urgentes++;
    });

    document.getElementById('count-pendientes').innerText = pendientes;
    document.getElementById('count-imprimiendo').innerText = imprimiendo;
    document.getElementById('count-listos').innerText = listos;
    document.getElementById('count-urgentes').innerText = urgentes;
}

// ==========================================
// 4. RENDERIZADO Y FILTRADO
// ==========================================
function filtrarPedidos() {
    const estadoFiltro = document.getElementById('filter-estado').value;
    const areaFiltro = document.getElementById('filter-area').value;
    const contenedor = document.getElementById('admin-pedidos-list');

    let filtrados = todosLosPedidos.filter(p => {
        const cumpleEstado = (estadoFiltro === "TODOS" || p.estado === estadoFiltro);
        const cumpleArea = (areaFiltro === "TODAS" || p.area === areaFiltro);
        return cumpleEstado && cumpleArea;
    });

    if (filtrados.length === 0) {
        contenedor.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-solid fa-inbox" style="font-size: 2.5rem; margin-bottom: 10px;"></i>
                <p>No hay solicitudes que coincidan con los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = filtrados.map(p => crearTarjetaHTML(p)).join('');
}

function crearTarjetaHTML(p) {
    let badgePrioridad = p.prioridad === 'Alta' 
        ? `<span style="background: rgba(255,77,77,0.2); color: var(--accent-red); border: 1px solid var(--accent-red); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;"><i class="fa-solid fa-bolt"></i> ALTA</span>`
        : `<span style="background: rgba(255,255,255,0.05); color: var(--text-muted); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${p.prioridad}</span>`;

    let linkHTML = p.linkArchivo && p.linkArchivo !== "N/A"
        ? `<a href="${p.linkArchivo}" target="_blank" style="color: var(--primary); font-size: 0.85rem; text-decoration: none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Plano / STL</a>`
        : `<span style="color: var(--text-muted); font-size: 0.85rem;">Sin enlace adjunto</span>`;

    return `
        <div class="glass-card admin-card">
            <div class="admin-card-header">
                <div>
                    <strong style="font-size: 1.1rem; color: var(--primary);">${p.codigo}</strong>
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">(${p.area})</span>
                </div>
                ${badgePrioridad}
            </div>

            <div class="admin-card-body">
                <p><strong><i class="fa-solid fa-user"></i> Requisitor:</strong> ${p.requisitor} (${p.email})</p>
                <p><strong><i class="fa-solid fa-layer-group"></i> Solicitud:</strong> ${p.tipoSolicitud}</p>
                <p><strong><i class="fa-solid fa-align-left"></i> Detalle:</strong> ${p.descripcion}</p>
                <p style="margin-top: 8px;"><strong><i class="fa-solid fa-link"></i> Adjunto:</strong> ${linkHTML}</p>
                <p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);"><strong>Estado actual:</strong> <span style="color: var(--text-main); font-weight: bold;">${p.estado}</span></p>
            </div>

            <div class="admin-card-actions">
                <button class="btn-action" onclick="cambiarEstado('${p.codigo}', 'Aprobado / En Cola')" title="Aprobar"><i class="fa-solid fa-check" style="color: var(--accent-yellow);"></i> Cola</button>
                <button class="btn-action" onclick="cambiarEstado('${p.codigo}', 'Imprimiendo')" title="Imprimiendo"><i class="fa-solid fa-cube" style="color: var(--primary);"></i> Imprimiendo</button>
                <button class="btn-action" onclick="cambiarEstado('${p.codigo}', 'Listo para Retiro')" title="Completar"><i class="fa-solid fa-circle-check" style="color: var(--accent-green);"></i> Listo</button>
                <button class="btn-action" onclick="abrirModalRechazo('${p.codigo}')" title="Rechazar"><i class="fa-solid fa-xmark" style="color: var(--accent-red);"></i> Rechazar</button>
            </div>
        </div>
    `;
}

// ==========================================
// 5. CAMBIO DE ESTADOS EN FIREBASE
// ==========================================
async function cambiarEstado(codigo, nuevoEstado, motivo = "") {
    const codigoLimpio = codigo.replace('#', '');
    const updates = {};
    updates[`pedidos/${codigoLimpio}/estado`] = nuevoEstado;
    if (motivo) {
        updates[`pedidos/${codigoLimpio}/motivoRechazo`] = motivo;
    }

    try {
        await update(ref(db), updates);
    } catch (error) {
        alert("Error al actualizar estado: " + error.message);
    }
}

function abrirModalRechazo(codigo) {
    document.getElementById('modal-rechazar-codigo').value = codigo;
    document.getElementById('motivo-rechazo-text').value = "";
    document.getElementById('modal-rechazar').classList.remove('hidden');
}

function cerrarModalRechazo() {
    document.getElementById('modal-rechazar').classList.add('hidden');
}

function confirmarRechazo() {
    const codigo = document.getElementById('modal-rechazar-codigo').value;
    const motivo = document.getElementById('motivo-rechazo-text').value.trim();

    if (!motivo) {
        alert("Por favor escribe el motivo del rechazo para informar al requisitor.");
        return;
    }

    cambiarEstado(codigo, 'Rechazado', motivo);
    cerrarModalRechazo();
}