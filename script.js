let materias = [];
let materiasCompletadas = new Set();
let filtroNivelActual = 0;

document.addEventListener("DOMContentLoaded", async () => {
  // Cargar datos
  const response = await fetch("malla.json");
  materias = await response.json();
  
  // Configurar eventos
  document.getElementById("guardar-btn").onclick = guardarProgreso;
  document.getElementById("limpiar-btn").onclick = limpiarProgreso;
  document.getElementById("exportar-btn").onclick = descargarPDF;
  document.getElementById("aplicar-filtro").onclick = aplicarFiltroNivel;
  
  // Inicializar
  cargarProgreso();
  renderMalla();
  actualizarPlanificador();
  actualizarResumenProgreso();
});

function aplicarFiltroNivel() {
  filtroNivelActual = parseInt(document.getElementById("filtro-nivel").value);
  renderMalla();
}

function renderMalla() {
  const container = document.getElementById("niveles-container");
  container.innerHTML = "";

  // Filtrar materias por nivel si hay filtro activo
  const materiasFiltradas = filtroNivelActual === 0 
    ? materias 
    : materias.filter(m => m.nivel === filtroNivelActual);

  const niveles = agruparPorNivel(materiasFiltradas);
  
  // Ordenar niveles numéricamente
  const nivelesOrdenados = Object.keys(niveles).sort((a, b) => a - b);
  
  for (const nivel of nivelesOrdenados) {
    const columna = document.createElement("div");
    columna.className = "columna-nivel";

    const titulo = document.createElement("h2");
    titulo.textContent = `Nivel ${nivel}`;
    columna.appendChild(titulo);

    // Ordenar materias por código
    const materiasNivel = niveles[nivel].sort((a, b) => {
      const codA = a.codigo?.toString() || "";
      const codB = b.codigo?.toString() || "";
      return codA.localeCompare(codB);
    });

    materiasNivel.forEach((materia) => {
      const bloque = crearBloqueMateria(materia);
      columna.appendChild(bloque);
    });

    container.appendChild(columna);
  }
}

function crearBloqueMateria(materia) {
  const bloque = document.createElement("div");
  bloque.className = `materia ${materia.area}`;
  
  // Manejar estado de la materia
  const codigoMateria = materia.codigo?.toString() || "";
  if (codigoMateria && materiasCompletadas.has(codigoMateria)) {
    bloque.classList.add("tachada");
  } else if (!puedeTomarse(materia)) {
    bloque.classList.add("bloqueada");
  }

  // Configurar evento de clic
  bloque.onclick = () => {
    if (!codigoMateria || !puedeTomarse(materia)) return;
    
    if (materiasCompletadas.has(codigoMateria)) {
      materiasCompletadas.delete(codigoMateria);
    } else {
      materiasCompletadas.add(codigoMateria);
    }
    
    guardarProgreso();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  };

  // Crear contenido del bloque
  const tabla = document.createElement("div");
  tabla.className = "info-tabla";

  // Mostrar información clave
  tabla.innerHTML = `
    <div class="celda">${materia.creditos} CR</div>
    <div class="celda">${materia.ht} HT</div>
    <div class="celda">${materia.hpr} HP</div>
    <div class="celda">${materia.curso}</div>
  `;

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  // Tooltip con prerrequisitos
  if (materia.prerequisitos?.length > 0) {
    bloque.title = `Prerrequisitos: ${materia.prerequisitos.join(", ")}`;
  }

  bloque.appendChild(tabla);
  bloque.appendChild(nombre);

  return bloque;
}

function agruparPorNivel(materias) {
  const niveles = {};
  materias.forEach((m) => {
    const nivel = m.nivel || "Sin Nivel";
    if (!niveles[nivel]) niveles[nivel] = [];
    niveles[nivel].push(m);
  });
  return niveles;
}

function puedeTomarse(materia) {
  // Solo materias con código pueden marcarse
  const codigoMateria = materia.codigo?.toString() || "";
  if (!codigoMateria) return false;
  
  // Verificar prerrequisitos
  return materia.prerequisitos?.every(pr => 
    pr && materiasCompletadas.has(pr.toString())
  ) ?? true;
}

function guardarProgreso() {
  const codigosCompletados = Array.from(materiasCompletadas).filter(c => c);
  localStorage.setItem("materiasCompletadas", JSON.stringify(codigosCompletados));
}

function cargarProgreso() {
  const data = localStorage.getItem("materiasCompletadas");
  if (data) {
    const codigos = JSON.parse(data);
    materiasCompletadas = new Set(codigos.filter(c => c));
  }
}

function limpiarProgreso() {
  if (confirm("¿Estás seguro de que quieres borrar todo tu progreso?")) {
    localStorage.removeItem("materiasCompletadas");
    materiasCompletadas.clear();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  }
}

function actualizarResumenProgreso() {
  const totalMaterias = materias.filter(m => m.codigo).length;
  const completadas = materiasCompletadas.size;
  const porcentaje = Math.round((completadas / totalMaterias) * 100);
  
  // Actualizar barra de progreso
  document.getElementById("barra-progreso").style.width = `${porcentaje}%`;
  document.getElementById("texto-progreso").textContent = `${porcentaje}% completado`;
  
  // Calcular créditos completados
  const creditosCompletados = materias
    .filter(m => m.codigo && materiasCompletadas.has(m.codigo.toString()))
    .reduce((sum, m) => sum + (m.creditos || 0), 0);
  
  // Actualizar textos
  document.getElementById("total-creditos").textContent = `Créditos completados: ${creditosCompletados}`;
  document.getElementById("total-materias").textContent = `Materias completadas: ${completadas}/${totalMaterias}`;
}

/* -------- Planificador Inteligente -------- */
function actualizarPlanificador() {
  const contenedor = document.getElementById("sugerencias-materias");
  contenedor.innerHTML = "";

  // Filtrar materias disponibles (con código, no completadas y que se pueden tomar)
  const disponibles = materias.filter(m => {
    const codigo = m.codigo?.toString() || "";
    return codigo && 
           !materiasCompletadas.has(codigo) && 
           puedeTomarse(m);
  });

  // Si no hay materias disponibles
  if (disponibles.length === 0) {
    contenedor.innerHTML = `<p class="no-sugerencias">¡Felicidades! Has completado todas las materias disponibles.</p>`;
    return;
  }

  // Calcular peso para cada materia
  const materiasConPeso = disponibles.map(m => {
    const codigo = m.codigo.toString();
    return {
      ...m,
      peso: calcularPesoMateria(m)
    };
  });

  // Ordenar por peso descendente
  materiasConPeso.sort((a, b) => b.peso - a.peso);

  // Generar dos opciones distintas
  const opciones = [
    generarOpcionInscripcion([...materiasConPeso]),
    generarOpcionInscripcion([...materiasConPeso].reverse())
  ];

  // Mostrar las opciones
  opciones.forEach((opcion, index) => {
    const grupo = document.createElement("div");
    grupo.className = "opcion-planificador";
    grupo.innerHTML = `<h3>Opción ${index + 1}:</h3>`;
    
    let creditosTotales = 0;
    
    opcion.forEach(materia => {
      creditosTotales += materia.creditos;
      
      const divMateria = document.createElement("div");
      divMateria.className = `materia-sugerida ${materia.area}`;
      divMateria.innerHTML = `
        <span>${materia.nombre}</span>
        <span>${materia.creditos} cr. (Nivel ${materia.nivel})</span>
      `;
      
      grupo.appendChild(divMateria);
    });
    
    // Mostrar total de créditos
    const divTotal = document.createElement("div");
    divTotal.className = "total-creditos";
    divTotal.textContent = `Total: ${creditosTotales}/18 créditos`;
    grupo.appendChild(divTotal);
    
    contenedor.appendChild(grupo);
  });
}

function calcularPesoMateria(materia) {
  const codigo = materia.codigo.toString();
  const creditos = materia.creditos || 0;
  const nivel = materia.nivel || 10;
  
  // 1. Materias que desbloquean más materias tienen mayor peso
  const desbloqueos = contarDesbloqueos(codigo);
  
  // 2. Materias de niveles más bajos tienen mayor peso
  const pesoNivel = 1 / nivel;
  
  // 3. Materias con más créditos tienen mayor peso
  const pesoCreditos = creditos / 4;
  
  // Peso total (puedes ajustar estos factores)
  return (desbloqueos * 2) + (pesoNivel * 3) + (pesoCreditos * 1);
}

function contarDesbloqueos(codigo) {
  return materias.filter(m => 
    m.prerequisitos?.includes(codigo) && 
    !materiasCompletadas.has(m.codigo?.toString() || "")
  ).length;
}

function generarOpcionInscripcion(materiasOrdenadas) {
  const seleccionadas = [];
  let creditosAcumulados = 0;
  const materiasConsideradas = new Set();
  
  for (const materia of materiasOrdenadas) {
    const codigo = materia.codigo.toString();
    
    // Saltar si ya se consideró esta materia o excede los créditos
    if (materiasConsideradas.has(codigo) || 
        creditosAcumulados + materia.creditos > 18) {
      continue;
    }
    
    seleccionadas.push(materia);
    creditosAcumulados += materia.creditos;
    materiasConsideradas.add(codigo);
    
    // Si llegamos cerca al límite, salir
    if (creditosAcumulados >= 15) break;
  }
  
  return seleccionadas;
}

/* -------- Exportar como PDF -------- */
function descargarPDF() {
  const element = document.createElement("div");
  element.className = "pdf-container";
  
  // Crear contenido para el PDF
  element.innerHTML = `
    <h1>Planificación Académica - Ingeniería Mecatrónica</h1>
    <div class="pdf-progreso">
      <h2>Progreso Actual</h2>
      <p>${document.getElementById("texto-progreso").textContent}</p>
      <p>${document.getElementById("total-creditos").textContent}</p>
      <p>${document.getElementById("total-materias").textContent}</p>
    </div>
    <div class="pdf-malla" id="pdf-malla"></div>
    <div class="pdf-sugerencias">
      <h2>Sugerencias de Inscripción</h2>
      <div id="pdf-sugerencias"></div>
    </div>
  `;
  
  // Clonar la malla actual
  const mallaClone = document.getElementById("niveles-container").cloneNode(true);
  element.querySelector("#pdf-malla").appendChild(mallaClone);
  
  // Clonar las sugerencias
  const sugerenciasClone = document.getElementById("sugerencias-materias").cloneNode(true);
  element.querySelector("#pdf-sugerencias").appendChild(sugerenciasClone);
  
  // Configurar opciones de PDF
  const opt = {
    margin: 10,
    filename: 'planificacion-mecatronica.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      scrollY: 0,
      logging: true,
      useCORS: true
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    }
  };
  
  // Generar PDF
  html2pdf().set(opt).from(element).save();
}
