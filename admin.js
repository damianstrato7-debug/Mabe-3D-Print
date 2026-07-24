// ==========================================
// 1. CONFIGURACIÓN DE FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let seccionActual = "activos";

// Instancias de gráficos Chart.js
let chartMatInstance = null;
let chartAreasInstance = null;
let chartUsersInstance = null;
let chartImpInstance = null;

// Exponer funciones globales
window.cambiarSeccion = cambiarSeccion;
window.cambiarEstado = cambiarEstado;
window.abrirModalRechazo = abrirModalRechazo;
window.cerrarModalRechazo = cerrarModalRechazo;
window.confirmarRechazo = confirmarRechazo;
window.abrirModalTecnico = abrirModalTecnico;
window.cerrarModalTecnico = cerrarModalTecnico;
window.guardarDatosTecnicos = guardarDatosTecnicos;
window.eliminarPedido = eliminarPedido;
window.filtrarPedidosActivos = filtrarPedidosActivos;
window.filtrarHistorial = filtrarHistorial;
window.renderizarEstadisticas = renderizarEstadisticas;

// ==========================================
// 2. ESCUCHA EN TIEMPO REAL
// ==========================================
const pedidosRef = ref(db, 'pedidos');

onValue(pedidosRef, (snapshot) => {
    const data = snapshot.val();
    todosLosPedidos = [];

    if (data) {
        Object.keys(data).forEach(key => {
            todosLosPedidos.push(data[key]);
        });
        todosLosPedidos.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
    }

    actualizarKPIs();
    if (seccionActual === 'activos') filtrarPedidosActivos();
    else if (seccionActual === 'historial') filtrarHistorial();
    else if (seccionActual === 'stats') renderizarEstadisticas();
});

// ==========================================
// 3. CAMBIO DE PESTAÑAS (TABS)
// ==========================================
function cambiarSeccion(seccion) {
    seccionActual = seccion;
    
    document.getElementById('sec-activos').classList.add('hidden');
    document.getElementById('sec-historial').classList.add('hidden');
    document.getElementById('sec-stats').classList.add('hidden');

    document.getElementById('tab-btn-activos').className = "btn btn-tab";
    document.getElementById('tab-btn-historial').className = "btn btn-tab";
    document.getElementById('tab-btn-stats').className = "btn btn-tab";

    if (seccion === 'activos') {
        document.getElementById('sec-activos').classList.remove('hidden');
        document.getElementById('tab-btn-activos').className = "btn btn-primary";
        filtrarPedidosActivos();
    } else if (seccion === 'historial') {
        document.getElementById('sec-historial').classList.remove('hidden');
        document.getElementById('tab-btn-historial').className = "btn btn-primary";
        filtrarHistorial();
    } else if (seccion === 'stats') {
        document.getElementById('sec-stats').classList.remove('hidden');
        document.getElementById('tab-btn-stats').className = "btn btn-primary";
        renderizarEstadisticas();
    }
}

// ==========================================
// 4. ACTUALIZACIÓN DE INDICADORES (KPIs)
// ==========================================
function actualizarKPIs() {
    let pendientes = 0;
    let cola = 0;
    let imprimiendo = 0;
    let urgentes = 0;

    let totalActivos = 0;
    let totalHistorial = 0;

    todosLosPedidos.forEach(p => {
        const esArchivado = (p.estado === "Listo para Retiro" || p.estado === "Rechazado");
        
        if (esArchivado) {
            totalHistorial++;
        } else {
            totalActivos++;
            if (p.estado === "Pendiente de Revisión") pendientes++;
            if (p.estado === "Aprobado / En Cola") cola++;
            if (p.estado === "Imprimiendo") imprimiendo++;
            if (p.prioridad === "Alta") urgentes++;
        }
    });

    document.getElementById('count-pendientes').innerText = pendientes;
    document.getElementById('count-cola').innerText = cola;
    document.getElementById('count-imprimiendo').innerText = imprimiendo;
    document.getElementById('count-urgentes').innerText = urgentes;

    document.getElementById('count-badge-activos').innerText = totalActivos;
    document.getElementById('count-badge-historial').innerText = totalHistorial;
}

// ==========================================
// 5. RENDERIZADO: PEDIDOS EN CURSO
// ==========================================
function filtrarPedidosActivos() {
    const estadoFiltro = document.getElementById('filter-estado-activo').value;
    const areaFiltro = document.getElementById('filter-area-activo').value;
    const contenedor = document.getElementById('admin-activos-list');

    let filtrados = todosLosPedidos.filter(p => {
        const esActivo = (p.estado !== "Listo para Retiro" && p.estado !== "Rechazado");
        const cumpleEstado = (estadoFiltro === "TODOS" || p.estado === estadoFiltro);
        const cumpleArea = (areaFiltro === "TODAS" || p.area === areaFiltro);
        return esActivo && cumpleEstado && cumpleArea;
    });

    if (filtrados.length === 0) {
        contenedor.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; margin-bottom: 10px; color: var(--accent-green);"></i>
                <p>No hay solicitudes pendientes o en curso en este momento.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = filtrados.map(p => crearTarjetaHTML(p, false)).join('');
}

// ==========================================
// 6. RENDERIZADO: HISTORIAL / ARCHIVADOS
// ==========================================
function filtrarHistorial() {
    const estadoFiltro = document.getElementById('filter-estado-historial').value;
    const areaFiltro = document.getElementById('filter-area-historial').value;
    const contenedor = document.getElementById('admin-historial-list');

    let filtrados = todosLosPedidos.filter(p => {
        const esArchivado = (p.estado === "Listo para Retiro" || p.estado === "Rechazado");
        const cumpleEstado = (estadoFiltro === "TODOS" || p.estado === estadoFiltro);
        const cumpleArea = (areaFiltro === "TODAS" || p.area === areaFiltro);
        return esArchivado && cumpleEstado && cumpleArea;
    });

    if (filtrados.length === 0) {
        contenedor.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fa-solid fa-box-open" style="font-size: 2.5rem; margin-bottom: 10px;"></i>
                <p>No se encontraron registros en el historial para los filtros seleccionados.</p>
            </div>
        `;
        return;
    }

    contenedor.innerHTML = filtrados.map(p => crearTarjetaHTML(p, true)).join('');
}

// ==========================================
// 7. CONSTRUCTOR DE TARJETAS HTML
// ==========================================
function crearTarjetaHTML(p, esHistorial) {
    let badgePrioridad = p.prioridad === 'Alta' 
        ? `<span style="background: rgba(255,77,77,0.2); color: var(--accent-red); border: 1px solid var(--accent-red); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: bold;"><i class="fa-solid fa-bolt"></i> ALTA</span>`
        : `<span style="background: rgba(255,255,255,0.05); color: var(--text-muted); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${p.prioridad}</span>`;

    let linkHTML = p.linkArchivo && p.linkArchivo !== "N/A"
        ? `<a href="${p.linkArchivo}" target="_blank" style="color: var(--primary); font-size: 0.85rem; text-decoration: none;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir Plano / STL</a>`
        : `<span style="color: var(--text-muted); font-size: 0.85rem;">Sin enlace adjunto</span>`;

    let datosTecnicosHTML = "";
    if (p.impresora || p.gramos || p.tipoMaterial) {
        datosTecnicosHTML = `
            <div style="background: rgba(0,229,255,0.05); border: 1px solid rgba(0,229,255,0.2); padding: 8px 12px; border-radius: 8px; margin-top: 10px; font-size: 0.82rem;">
                <p style="margin-bottom: 3px; color: var(--primary);"><strong><i class="fa-solid fa-print"></i> Impresora:</strong> ${p.impresora || 'Sin asignar'}</p>
                <p style="margin: 0; color: var(--text-main);"><strong><i class="fa-solid fa-cube"></i> Material:</strong> ${p.gramos ? p.gramos + 'g' : '? g'} (${p.tipoMaterial || 'PLA'})</p>
            </div>
        `;
    }

    let motivoRechazoHTML = p.motivoRechazo ? `<p style="color: var(--accent-red); margin-top: 5px; font-size: 0.82rem;"><strong>Motivo rechazo:</strong> ${p.motivoRechazo}</p>` : '';

    // Botones dinámicos según si está activo o en el historial
    let accionesHTML = "";
    if (!esHistorial) {
        accionesHTML = `
            <div class="admin-card-actions">
                <button class="btn-action" onclick="abrirModalTecnico('${p.codigo}', '${p.impresora || 'Bambu'}', '${p.gramos || ''}', '${p.tipoMaterial || 'PLA'}')" title="Ficha Técnica"><i class="fa-solid fa-sliders" style="color: var(--primary);"></i> Ficha</button>
                <button class="btn-action" onclick="cambiarEstado('${p.codigo}', 'Imprimiendo')" title="Imprimiendo"><i class="fa-solid fa-cube" style="color: var(--primary);"></i> Imprimiendo</button>
                <button class="btn-action" onclick="cambiarEstado('${p.codigo}', 'Listo para Retiro')" title="Finalizar y Archivar" style="border-color: var(--accent-green);"><i class="fa-solid fa-box-archive" style="color: var(--accent-green);"></i> Archivar (Listo)</button>
                <button class="btn-action" onclick="abrirModalRechazo('${p.codigo}')" title="Rechazar"><i class="fa-solid fa-xmark" style="color: var(--accent-red);"></i> Rechazar</button>
            </div>
        `;
    } else {
        accionesHTML = `
            <div class="admin-card-actions">
                <button class="btn-action" onclick="cambiarEstado('${p.codigo}', 'Pendiente de Revisión')" title="Reactivar pedido" style="grid-column: 1 / -1;"><i class="fa-solid fa-rotate-left" style="color: var(--accent-yellow);"></i> Reactivar / Devolver a Curso</button>
            </div>
        `;
    }

    return `
        <div class="glass-card admin-card">
            <div class="admin-card-header">
                <div>
                    <strong style="font-size: 1.1rem; color: var(--primary);">${p.codigo}</strong>
                    <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 8px;">(${p.area})</span>
                </div>
                <div style="display:flex; align-items:center; gap: 8px;">
                    ${badgePrioridad}
                    <button onclick="eliminarPedido('${p.codigo}')" title="Eliminar definitivamente" style="background:none; border:none; color: var(--accent-red); cursor:pointer; font-size: 1rem; padding: 2px 5px;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            <div class="admin-card-body">
                <p><strong><i class="fa-solid fa-user"></i> Requisitor:</strong> ${p.requisitor} (${p.email})</p>
                <p><strong><i class="fa-solid fa-layer-group"></i> Solicitud:</strong> ${p.tipoSolicitud}</p>
                <p><strong><i class="fa-solid fa-align-left"></i> Detalle:</strong> ${p.descripcion}</p>
                <p style="margin-top: 6px;"><strong><i class="fa-solid fa-link"></i> Adjunto:</strong> ${linkHTML}</p>
                
                ${datosTecnicosHTML}
                ${motivoRechazoHTML}

                <p style="margin-top: 8px; font-size: 0.8rem; color: var(--text-muted);"><strong>Estado:</strong> <span style="color: var(--text-main); font-weight: bold;">${p.estado}</span></p>
            </div>

            ${accionesHTML}
        </div>
    `;
}

// ==========================================
// 8. MÓDULO DE ESTADÍSTICAS & ANÁLISIS
// ==========================================
function renderizarEstadisticas() {
    const rangoDias = document.getElementById('stats-time-range').value;
    const ahora = new Date();

    // Filtrar por tiempo
    let pedidosFiltrados = todosLosPedidos.filter(p => {
        if (rangoDias === 'ALL') return true;
        const fechaPedido = new Date(p.fechaCreacion);
        const diferenciaDias = (ahora - fechaPedido) / (1000 * 3600 * 24);
        return diferenciaDias <= parseInt(rangoDias);
    });

    // Acumuladores
    let totalGramos = 0;
    let totalCompletados = 0;
    let contadorMateriales = {};
    let contadorAreas = {};
    let contadorUsuarios = {};
    let contadorImpresoras = {};

    pedidosFiltrados.forEach(p => {
        // Gramos
        if (p.gramos && !isNaN(p.gramos)) {
            const g = parseFloat(p.gramos);
            totalGramos += g;

            const mat = p.tipoMaterial || 'PLA';
            contadorMateriales[mat] = (contadorMateriales[mat] || 0) + g;
        }

        // Completados
        if (p.estado === 'Listo para Retiro') {
            totalCompletados++;
        }

        // Áreas
        if (p.area) {
            contadorAreas[p.area] = (contadorAreas[p.area] || 0) + 1;
        }

        // Requisitores
        if (p.requisitor) {
            contadorUsuarios[p.requisitor] = (contadorUsuarios[p.requisitor] || 0) + 1;
        }

        // Impresoras
        if (p.impresora) {
            contadorImpresoras[p.impresora] = (contadorImpresoras[p.impresora] || 0) + 1;
        }
    });

    // Actualizar KPI Cards de Stats
    document.getElementById('stat-total-gramos').innerText = totalGramos >= 1000 ? (totalGramos / 1000).toFixed(2) + ' Kg' : Math.round(totalGramos) + ' g';
    document.getElementById('stat-total-completados').innerText = totalCompletados;

    // Obtener Top Área
    const topArea = Object.keys(contadorAreas).reduce((a, b) => contadorAreas[a] > contadorAreas[b] ? a : b, '-');
    document.getElementById('stat-top-area-nombre').innerText = topArea !== '-' ? `${topArea} (${contadorAreas[topArea]})` : '-';

    // Obtener Top Requisitor
    const topUser = Object.keys(contadorUsuarios).reduce((a, b) => contadorUsuarios[a] > contadorUsuarios[b] ? a : b, '-');
    document.getElementById('stat-top-user-nombre').innerText = topUser !== '-' ? `${topUser} (${contadorUsuarios[topUser]})` : '-';

    // RENDERIZAR GRÁFICOS (Chart.js)
    
    // 1. Gráfico Materiales
    const ctxMat = document.getElementById('chartMateriales').getContext('2d');
    if (chartMatInstance) chartMatInstance.destroy();
    chartMatInstance = new Chart(ctxMat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(contadorMateriales).length ? Object.keys(contadorMateriales) : ['Sin datos'],
            datasets: [{
                data: Object.values(contadorMateriales).length ? Object.values(contadorMateriales) : [1],
                backgroundColor: ['#00e5ff', '#ffb703', '#ff4d4d', '#00e676', '#a855f7', '#64748b']
            }]
        },
        options: { plugins: { legend: { labels: { color: '#ffffff' } } } }
    });

    // 2. Gráfico Áreas
    const ctxArea = document.getElementById('chartAreas').getContext('2d');
    if (chartAreasInstance) chartAreasInstance.destroy();
    chartAreasInstance = new Chart(ctxArea, {
        type: 'bar',
        data: {
            labels: Object.keys(contadorAreas),
            datasets: [{
                label: 'Pedidos',
                data: Object.values(contadorAreas),
                backgroundColor: '#00e5ff'
            }]
        },
        options: {
            scales: {
                x: { ticks: { color: '#ffffff' } },
                y: { ticks: { color: '#ffffff' }, beginAtZero: true }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 3. Gráfico Top Requisitores
    const top5UsersKeys = Object.keys(contadorUsuarios).sort((a,b) => contadorUsuarios[b] - contadorUsuarios[a]).slice(0, 5);
    const top5UsersValues = top5UsersKeys.map(k => contadorUsuarios[k]);

    const ctxUser = document.getElementById('chartUsuarios').getContext('2d');
    if (chartUsersInstance) chartUsersInstance.destroy();
    chartUsersInstance = new Chart(ctxUser, {
        type: 'bar',
        data: {
            labels: top5UsersKeys,
            datasets: [{
                label: 'Solicitudes',
                data: top5UsersValues,
                backgroundColor: '#ffb703'
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: { ticks: { color: '#ffffff' }, beginAtZero: true },
                y: { ticks: { color: '#ffffff' } }
            },
            plugins: { legend: { display: false } }
        }
    });

    // 4. Gráfico Carga Impresoras
    const ctxImp = document.getElementById('chartImpresoras').getContext('2d');
    if (chartImpInstance) chartImpInstance.destroy();
    chartImpInstance = new Chart(ctxImp, {
        type: 'pie',
        data: {
            labels: Object.keys(contadorImpresoras).length ? Object.keys(contadorImpresoras) : ['Sin datos'],
            datasets: [{
                data: Object.values(contadorImpresoras).length ? Object.values(contadorImpresoras) : [1],
                backgroundColor: ['#00e676', '#00e5ff', '#a855f7', '#ffb703']
            }]
        },
        options: { plugins: { legend: { labels: { color: '#ffffff' } } } }
    });
}

// ==========================================
// 9. ACCIONES FIREBASE
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

function abrirModalTecnico(codigo, impresoraActual, gramosActual, materialActual) {
    document.getElementById('modal-tecnico-codigo').value = codigo;
    document.getElementById('modal-tecnico-sub').innerText = "Pedido: " + codigo;
    document.getElementById('select-impresora').value = impresoraActual || "Bambu";
    document.getElementById('input-gramos').value = gramosActual || "";
    document.getElementById('input-material').value = materialActual || "PLA";
    document.getElementById('modal-tecnico').classList.remove('hidden');
}

function cerrarModalTecnico() {
    document.getElementById('modal-tecnico').classList.add('hidden');
}

async function guardarDatosTecnicos() {
    const codigo = document.getElementById('modal-tecnico-codigo').value;
    const impresora = document.getElementById('select-impresora').value;
    const gramos = document.getElementById('input-gramos').value;
    const tipoMaterial = document.getElementById('input-material').value;

    const codigoLimpio = codigo.replace('#', '');
    const updates = {};
    updates[`pedidos/${codigoLimpio}/impresora`] = impresora;
    updates[`pedidos/${codigoLimpio}/gramos`] = gramos;
    updates[`pedidos/${codigoLimpio}/tipoMaterial`] = tipoMaterial;

    try {
        await update(ref(db), updates);
        cerrarModalTecnico();
    } catch (error) {
        alert("Error al guardar ficha técnica: " + error.message);
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

async function confirmarRechazo() {
    const codigo = document.getElementById('modal-rechazar-codigo').value;
    const motivo = document.getElementById('motivo-rechazo-text').value.trim();

    if (!motivo) {
        alert("Por favor escribe el motivo del rechazo.");
        return;
    }

    await cambiarEstado(codigo, 'Rechazado', motivo);
    cerrarModalRechazo();
}

async function eliminarPedido(codigo) {
    const confirmar = confirm(`¿Estás seguro de que deseas eliminar permanentemente el pedido ${codigo}?`);
    
    if (confirmar) {
        const codigoLimpio = codigo.replace('#', '');
        try {
            await remove(ref(db, `pedidos/${codigoLimpio}`));
        } catch (error) {
            alert("Error al borrar pedido: " + error.message);
        }
    }
}
