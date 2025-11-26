document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-item-form');
    const tableBody = document.querySelector('#schedule-table tbody');
    const exportBtn = document.getElementById('export-btn');
    const searchInput = document.getElementById('search-input');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const formCard = document.getElementById('form-card');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const historyBtn = document.getElementById('history-btn');

    let summaryChart = null; // Variable para guardar la instancia del gráfico

    const API_URL = "https://metrologia-backend-6xdc.onrender.com";

    let scheduleData = [];
    async function exportarHistorialCompleto() {
        try {
            const res = await fetch(`${API_URL}/cronograma/historial`);
            const historial = await res.json();

            if (!Array.isArray(historial) || historial.length === 0) {
                alert("No hay historial disponible.");
                return;
            }

            let excelData = [];

            historial.forEach((version, index) => {
                const fecha = new Date(version.fecha).toLocaleString('es-CO');

                // Encabezado de la versión
                excelData.push([`CRONOGRAMA REGISTRADO EL: ${fecha}`]);
                excelData.push([]); // línea vacía

                // Encabezados reales
                excelData.push([
                    "ID", "Nombre Equipo", "Ubicación",
                    "Mantenimiento", "Proveedor", "Días", "Estado",
                    "Calibración", "Proveedor", "Días", "Estado",
                    "Calificación", "Proveedor", "Días", "Estado",
                    "Observaciones"
                ]);

                // Filas
                version.tabla.forEach(item => {
                    const mant = calculateStatus(item.mantenimiento);
                    const cali = calculateStatus(item.calibracion);
                    const calif = calculateStatus(item.calificacion);

                    excelData.push([
                        item.id,
                        item.nombreEquipo,
                        item.ubicacion,
                        item.mantenimiento || "N/A",
                        item.proveedorMantenimiento || "",
                        mant.days,
                        mant.status,
                        item.calibracion || "N/A",
                        item.proveedorCalibracion || "",
                        cali.days,
                        cali.status,
                        item.calificacion || "N/A",
                        item.proveedorCalificacion || "",
                        calif.days,
                        calif.status,
                        item.observaciones || ""
                    ]);
                });

                excelData.push([]); 
                excelData.push([]); 
            });

            // Crear hoja
            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Historial");

            XLSX.writeFile(workbook, "Historial_Cronogramas.xlsx");

        } catch (error) {
            console.error("Error exportando historial:", error);
            alert("Error exportando historial");
        }
    }

async function cargarDesdeBackend() {
    try {
        const res = await fetch(`${API_URL}/cronograma`);

        // comprobar si viene JSON REAL
        const text = await res.text();
        let data;

        try {
            data = JSON.parse(text); 
        } catch {
            console.log("⚠ Backend no responde JSON (Render está despertando)");
            return; // no intentamos renderizar nada
        }

        scheduleData = data.tabla || [];
        renderTable(scheduleData);

    } catch (error) {
        console.error("Error cargando cronograma:", error);
    }
}

    async function guardarEnBaseDeDatos() {
    try {
        const res = await fetch(`${API_URL}/guardar-cronograma`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tabla: scheduleData }) // enviamos toda la tabla que ves en pantalla
        });

        const data = await res.json();
        alert("✔ Cronograma guardado correctamente en la base de datos");

        console.log("Respuesta del backend:", data);

    } catch (error) {
        console.error("Error guardando en backend:", error);
        alert("❌ Ocurrió un error guardando los datos");
    }
}

    // Función para calcular días restantes y estado
    const calculateStatus = (dateString) => {
        if (!dateString) return { days: '-', status: 'N/A', statusClass: 'no-aplica' };
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Ignorar la hora para la comparación
        const nextDate = new Date(dateString + 'T00:00:00'); // Evitar problemas de zona horaria

        const diffTime = nextDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { days: diffDays, status: 'Vencido', statusClass: 'vencido' };
        } else if (diffDays <= 30) {
            return { days: diffDays, status: 'Próximo', statusClass: 'proximo' };
        } else {
            return { days: diffDays, status: 'Vigente', statusClass: 'vigente' };
        }
    };

    // Función para renderizar el cuadro de resumen
    const renderSummary = (data) => {
        let vencidoCount = 0;
        let proximoCount = 0;
        let vigenteCount = 0;

        data.forEach(item => {
            ['mantenimiento', 'calibracion', 'calificacion'].forEach(activityType => {
                if (item[activityType]) {
                    const status = calculateStatus(item[activityType]);
                    if (status.statusClass === 'vencido') vencidoCount++;
                    else if (status.statusClass === 'proximo') proximoCount++;
                    else if (status.statusClass === 'vigente') vigenteCount++;
                }
            });
        });

        const ctx = document.getElementById('summary-chart').getContext('2d');
        if (summaryChart) {
            summaryChart.destroy(); // Destruye el gráfico anterior para evitar superposiciones
        }

        summaryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Vencidos', 'Próximos', 'Vigentes'],
                datasets: [{
                    data: [vencidoCount, proximoCount, vigenteCount],
                    backgroundColor: [
                        '#e74c3c', // Rojo (Vencido)
                        '#f39c12', // Naranja (Próximo)
                        '#2ecc71'  // Verde (Vigente)
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    datalabels: {
                        formatter: (value, ctx) => {
                            const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            const percentage = (value * 100 / sum).toFixed(1) + '%';
                            return sum > 0 && value > 0 ? percentage : '';
                        },
                        color: '#fff',
                        font: {
                            weight: 'bold',
                            size: 10 // Tamaño de la fuente para los porcentajes
                        }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    };

    // Función para renderizar (dibujar) la tabla
    const renderTable = (data) => {
        tableBody.innerHTML = '';
        renderSummary(data); // Llama a la función para actualizar el resumen

        // Añadir el primer encabezado de grupo si los datos correspondientes están presentes
        if (data.some(item => [15321, 1, 16444, 2, 3, 4, 41902437].includes(item.id))) {
            const groupHeaderRow1 = document.createElement('tr');
            groupHeaderRow1.classList.add('group-header'); 
            groupHeaderRow1.innerHTML = `<td colspan="17">EQUIPOS MEDICAL RESEARCH CENTER (Clínica Universidad de La Sabana)</td>`;
            tableBody.appendChild(groupHeaderRow1);
        }

        data.forEach(item => {
            // Insertar el segundo encabezado antes del equipo con ID 5
            if (item.id === 5) {
                const groupHeaderRow2 = document.createElement('tr');
                groupHeaderRow2.classList.add('backup-header'); // Mantenemos esta clase por si se quiere diferenciar en el futuro
                groupHeaderRow2.innerHTML = `<td colspan="17">EQUIPOS BACK-UP (Universidad de La Sabana)</td>`;
                tableBody.appendChild(groupHeaderRow2);
            }

            // Insertar el encabezado "SENSORES DE TEMPERATURA Y HUMEDAD" antes del equipo con ID 18235
            if (item.id === 18235) {
                const groupHeaderRow3 = document.createElement('tr');
                groupHeaderRow3.classList.add('group-header');
                groupHeaderRow3.innerHTML = `<td colspan="17">SENSORES DE TEMPERATURA Y HUMEDAD</td>`;
                tableBody.appendChild(groupHeaderRow3);
            }

            // Insertar el cuarto encabezado antes del equipo con ID 9
            if (item.id === 9) {
                const groupHeaderRow4 = document.createElement('tr');
                groupHeaderRow4.classList.add('group-header');
                groupHeaderRow4.innerHTML = `<td colspan="17">OTROS</td>`;
                tableBody.appendChild(groupHeaderRow4);
            }

            const mantenimientoStatus = calculateStatus(item.mantenimiento);
            const calibracionStatus = calculateStatus(item.calibracion);
            const calificacionStatus = calculateStatus(item.calificacion);

            const row = document.createElement('tr');
            // Asignamos un ID único al elemento de la fila para futuras referencias (ej: editar)
            row.dataset.id = item.id;
            row.innerHTML = `
                <td>${item.id}</td>
                <td>${item.nombreEquipo}</td>
                <td>${item.ubicacion}</td>
                <td>${item.mantenimiento || 'N/A'}</td>
                <td>${item.proveedorMantenimiento || ''}</td>
                <td>${mantenimientoStatus.days}</td>
                <td><span class="status ${mantenimientoStatus.statusClass}">${mantenimientoStatus.status}</span></td>
                <td>${item.calibracion || 'N/A'}</td>
                <td>${item.proveedorCalibracion || ''}</td>
                <td>${calibracionStatus.days}</td>
                <td><span class="status ${calibracionStatus.statusClass}">${calibracionStatus.status}</span></td>
                <td>${item.calificacion || 'N/A'}</td>
                <td>${item.proveedorCalificacion || ''}</td>
                <td>${calificacionStatus.days}</td>
                <td><span class="status ${calificacionStatus.statusClass}">${calificacionStatus.status}</span></td>
                <td class="observaciones-cell">${item.observaciones || ''}</td>
                <td>
                    <select class="action-select" onchange="handleAction(this, ${item.id})">
                        <option selected disabled>Seleccionar...</option>
                        <option value="modificar">Modificar</option>
                        <option value="eliminar">Eliminar</option>
                    </select>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Función para guardar los datos en localStorage
    const saveData = () => {
        localStorage.setItem('metrologySchedule', JSON.stringify(scheduleData));
    };

    // Función para añadir un nuevo item
    const handleFormSubmit = (event) => {
        event.preventDefault(); // Evita que la página se recargue

        const editId = document.getElementById('edit-item-id').value;

        if (editId) {
            // Modo Edición: Actualizar el item existente
            const itemIndex = scheduleData.findIndex(item => item.id == editId);
            if (itemIndex > -1) {
                const newId = parseInt(document.getElementById('item-id').value, 10);
                // Si el ID ha cambiado, verificar que no exista ya en otro equipo
                if (newId !== scheduleData[itemIndex].id && scheduleData.some(item => item.id === newId)) {
                    alert('El ID introducido ya existe. Por favor, elige un ID único.');
                    return; // Detener el envío del formulario
                }
                scheduleData[itemIndex].id = newId;
                scheduleData[itemIndex].nombreEquipo = document.getElementById('nombre-equipo').value;
                scheduleData[itemIndex].ubicacion = document.getElementById('ubicacion').value;
                scheduleData[itemIndex].mantenimiento = document.getElementById('mantenimiento-date').value;
                scheduleData[itemIndex].proveedorMantenimiento = document.getElementById('proveedor-mantenimiento').value;
                scheduleData[itemIndex].calibracion = document.getElementById('calibracion-date').value;
                scheduleData[itemIndex].proveedorCalibracion = document.getElementById('proveedor-calibracion').value;
                scheduleData[itemIndex].calificacion = document.getElementById('calificacion-date').value;
                scheduleData[itemIndex].proveedorCalificacion = document.getElementById('proveedor-calificacion').value;
                scheduleData[itemIndex].observaciones = document.getElementById('observaciones').value;
            }
        } else {
            // Modo Añadir: Crear un nuevo item
            const newId = parseInt(document.getElementById('item-id').value, 10);
            // Verificar que el ID no exista
            if (scheduleData.some(item => item.id === newId)) {
                alert('El ID introducido ya existe. Por favor, elige un ID único.');
                return; // Detener el envío del formulario
            }
            const newItem = {
                id: newId,
                nombreEquipo: document.getElementById('nombre-equipo').value,
                ubicacion: document.getElementById('ubicacion').value,
                mantenimiento: document.getElementById('mantenimiento-date').value,
                proveedorMantenimiento: document.getElementById('proveedor-mantenimiento').value,
                calibracion: document.getElementById('calibracion-date').value,
                proveedorCalibracion: document.getElementById('proveedor-calibracion').value,
                calificacion: document.getElementById('calificacion-date').value,
                proveedorCalificacion: document.getElementById('proveedor-calificacion').value,
                observaciones: document.getElementById('observaciones').value,
            };
            scheduleData.push(newItem);
        }

        saveData();
        renderTable(scheduleData);
        resetForm();
    };

    // Función para resetear el formulario al modo "Añadir"
    const resetForm = () => {
        form.reset();
        document.getElementById('edit-item-id').value = '';
        formTitle.textContent = 'Añadir Equipo';
        submitBtn.textContent = 'Añadir al Cronograma';
        cancelBtn.style.display = 'none';
        formCard.style.display = 'none';
    };

    // Función para eliminar un item por su ID (se hace global para poder llamarla desde el HTML)
    window.deleteItem = (id) => {
        if (confirm('¿Estás seguro de que quieres eliminar este elemento?')) {
            // Filtramos el array para mantener todos los elementos excepto el que coincide con el id
            scheduleData = scheduleData.filter(item => item.id !== id);
            saveData();
            renderTable(scheduleData);
        }
    };

    // Función para manejar las acciones del desplegable
    window.handleAction = (selectElement, id) => {
        const action = selectElement.value;
        if (action === 'modificar') {
            window.editItem(id);
        } else if (action === 'eliminar') {
            window.deleteItem(id);
        }
        // Resetea el desplegable para poder seleccionar la misma opción de nuevo
        selectElement.selectedIndex = 0;
    };

    // Función para entrar en modo edición
    window.editItem = (id) => {
        const itemToEdit = scheduleData.find(item => item.id === id);
        if (!itemToEdit) return;

        document.getElementById('edit-item-id').value = itemToEdit.id;
        document.getElementById('item-id').value = itemToEdit.id;
        document.getElementById('nombre-equipo').value = itemToEdit.nombreEquipo;
        document.getElementById('ubicacion').value = itemToEdit.ubicacion;
        document.getElementById('mantenimiento-date').value = itemToEdit.mantenimiento;
        document.getElementById('proveedor-mantenimiento').value = itemToEdit.proveedorMantenimiento;
        document.getElementById('calibracion-date').value = itemToEdit.calibracion;
        document.getElementById('proveedor-calibracion').value = itemToEdit.proveedorCalibracion;
        document.getElementById('calificacion-date').value = itemToEdit.calificacion;
        document.getElementById('proveedor-calificacion').value = itemToEdit.proveedorCalificacion;
        document.getElementById('observaciones').value = itemToEdit.observaciones;

        formTitle.textContent = 'Modificar Equipo';
        submitBtn.textContent = 'Guardar Cambios';
        cancelBtn.style.display = 'inline-block';
        formCard.style.display = 'block';
        window.scrollTo(0, 0); // Lleva al usuario al inicio de la página para ver el formulario
    };

    // Función para exportar a Excel
const exportToExcel = () => {
    // 1. Preparar los datos en un formato de array de arrays
    let excelData = [];

    // Encabezados principales (fusionados)
    const header1 = ["ID", "Nombre Equipo", "Ubicación", "Mantenimiento", null, null, null, "Calibración", null, null, null, "Calificación", null, null, null, "Observaciones"];
    const header2 = [null, null, null, "Próxima Fecha", "Proveedor", "Días Restantes", "Estado", "Próxima Fecha", "Proveedor", "Días Restantes", "Estado", "Próxima Fecha", "Proveedor", "Días Restantes", "Estado", null];
    excelData.push(header1, header2);

    // Estilos
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4F81BD" } }, alignment: { horizontal: "center", vertical: "center" } };
    const groupHeaderStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "6c757d" } }, alignment: { horizontal: "center" } };
    const statusStyles = {
        vencido: { fill: { fgColor: { rgb: "e74c3c" } }, font: { color: { rgb: "FFFFFF" } } },
        proximo: { fill: { fgColor: { rgb: "f39c12" } } },
        vigente: { fill: { fgColor: { rgb: "2ecc71" } } }
    };
    const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

    // 2. Procesar los datos de scheduleData para añadir filas y encabezados de grupo
    const addGroupHeader = (text) => {
        excelData.push([text, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null]);
    };
    // Añadir el primer encabezado de grupo
    addGroupHeader("EQUIPOS MEDICAL RESEARCH CENTER (Clínica Universidad de La Sabana)");

    scheduleData.forEach(item => {
        // Insertar encabezados de grupo según el ID
        if (item.id === 5) addGroupHeader("EQUIPOS BACK-UP (Universidad de La Sabana)");
        if (item.id === 18235) addGroupHeader("SENSORES DE TEMPERATURA Y HUMEDAD");
        if (item.id === 9) addGroupHeader("OTROS");

        const mantenimientoStatus = calculateStatus(item.mantenimiento);
        const calibracionStatus = calculateStatus(item.calibracion);
        const calificacionStatus = calculateStatus(item.calificacion);

        const rowData = [
            item.id,
            item.nombreEquipo,
            item.ubicacion,
            item.mantenimiento || 'N/A',
            item.proveedorMantenimiento || '',
            mantenimientoStatus.days,
            mantenimientoStatus.status,
            item.calibracion || 'N/A',
            item.proveedorCalibracion || '',
            calibracionStatus.days,
            calibracionStatus.status,
            item.calificacion || 'N/A',
            item.proveedorCalificacion || '',
            calificacionStatus.days,
            calificacionStatus.status,
            item.observaciones || ''
        ];
        excelData.push(rowData);
    });

    // 3. Crear la hoja de cálculo y aplicar estilos
    const worksheet = XLSX.utils.aoa_to_sheet(excelData);

    // Aplicar fusiones de celdas para los encabezados
    worksheet['!merges'] = [
        // Encabezados principales
        { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // ID
        { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Nombre Equipo
        { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Ubicación
        { s: { r: 0, c: 3 }, e: { r: 0, c: 6 } }, // Mantenimiento
        { s: { r: 0, c: 7 }, e: { r: 0, c: 10 } }, // Calibración
        { s: { r: 0, c: 11 }, e: { r: 0, c: 14 } }, // Calificación
        { s: { r: 0, c: 15 }, e: { r: 1, c: 15 } }, // Observaciones
    ];

    // Calcular anchos de columna y aplicar estilos
    const colWidths = [];
    for (let R = 0; R < excelData.length; ++R) {
        // Fusionar celdas de encabezados de grupo
        if (excelData[R].length === 16 && excelData[R][1] === null && R > 1) {
             (worksheet['!merges'] = worksheet['!merges'] || []).push({ s: { r: R, c: 0 }, e: { r: R, c: 15 } });
        }

        for (let C = 0; C < excelData[R].length; ++C) {
            const cell_address = { c: C, r: R };
            const cell_ref = XLSX.utils.encode_cell(cell_address);
            if (!worksheet[cell_ref]) continue;

            // Aplicar bordes a todas las celdas
            worksheet[cell_ref].s = { ...worksheet[cell_ref].s, border: borderStyle };

            const isGroupHeader = excelData[R].length === 16 && excelData[R][1] === null && R > 1;
            const isMainHeader = R < 2;

            // Estilos de encabezado
            if (isMainHeader) worksheet[cell_ref].s = { ...worksheet[cell_ref].s, ...headerStyle };
            if (isGroupHeader) worksheet[cell_ref].s = { ...worksheet[cell_ref].s, ...groupHeaderStyle };

            // Estilos de estado
            const cellValue = worksheet[cell_ref].v; // Sobrescribe el color de fondo si es una celda de estado
            if (cellValue === 'Vencido') worksheet[cell_ref].s = { ...worksheet[cell_ref].s, ...statusStyles.vencido };
            if (cellValue === 'Próximo') worksheet[cell_ref].s = { ...worksheet[cell_ref].s, ...statusStyles.proximo };
            if (cellValue === 'Vigente') worksheet[cell_ref].s = { ...worksheet[cell_ref].s, ...statusStyles.vigente };

            // Calcular ancho de columna
            const cellText = excelData[R][C] ? String(excelData[R][C]) : '';
            colWidths[C] = Math.max(colWidths[C] || 10, cellText.length + 2);
        }
    }
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }));

    // 4. Crear y descargar el libro de trabajo
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cronograma');

        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Enero es 0
        const day = String(today.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        const fileName = `Cronograma_Metrologia_${formattedDate}.xlsx`;

        XLSX.writeFile(workbook, fileName);
    };

    // Función para filtrar la tabla según la búsqueda
    const filterTable = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredData = scheduleData.filter(item => 
            item.nombreEquipo.toLowerCase().includes(searchTerm) ||
            item.ubicacion.toLowerCase().includes(searchTerm)
        );
        renderTable(filteredData);
    };

    // Función para mostrar/ocultar el formulario
    const toggleForm = () => {
        const isFormVisible = formCard.style.display === 'block';
        resetForm(); // Siempre resetea el formulario para limpiar datos de edición
        if (!isFormVisible) {
            formTitle.textContent = 'Añadir Equipo';
            formCard.style.display = 'block';
        }
    };

    // Asignar eventos a los elementos
    form.addEventListener('submit', handleFormSubmit);
    exportBtn.addEventListener('click', exportToExcel);
    searchInput.addEventListener('input', filterTable);
    cancelBtn.addEventListener('click', resetForm);
    toggleFormBtn.addEventListener('click', toggleForm);
    document.getElementById('save-db-btn').addEventListener('click', guardarEnBaseDeDatos);

    historyBtn.addEventListener("click", exportarHistorialCompleto);


    // Renderizar la tabla por primera vez al cargar la página
    cargarDesdeBackend();
});
