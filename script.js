let materias = [];
let materiasCompletadas = new Set();
let filtroNivelActual = 0;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("malla.json");
    if (!response.ok) throw new Error("Error al cargar malla.json");
    materias = await response.json();
    
    // Asignar IDs únicos a cada materia
    materias.forEach((materia, index) => {
      materia.idUnico = generarIdUnico(materia, index);
    });
    
    // Configurar eventos
    document.getElementById("guardar-btn").addEventListener("click", guardarProgreso);
    document.getElementById("limpiar-btn").addEventListener("click", limpiarProgreso);
    document.getElementById("exportar-btn").addEventListener("click", descargarPDF);
    document.getElementById("aplicar-filtro").addEventListener("click", aplicarFiltroNivel);
    
    cargarProgreso();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  } catch (error) {
    console.error("Error inicial:", error);
    alert("Error al cargar los datos. Ver consola para detalles.");
  }
});

// Genera un ID único para cada materia
function generarIdUnico(materia, index) {
  // Usamos código + nombre + índice para garantizar unicidad
  return `${normalizarCodigo(materia.codigo)}-${normalizarCodigo(materia.nombre)}-${index}`;
}

function normalizarCodigo(codigo) {
  if (!codigo) return '';
  return codigo.toString()
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function aplicarFiltroNivel() {
  filtroNivelActual = parseInt(document.getElementById("filtro-nivel").value) || 0;
  renderMalla();
}

function renderMalla() {
  const container = document.getElementById("niveles-container");
  container.innerHTML = "";

  const materiasFiltradas = filtroNivelActual === 0 
    ? materias 
    : materias.filter(m => m.nivel === filtroNivelActual);

  const niveles = agruparPorNivel(materiasFiltradas);
  const nivelesOrdenados = Object.keys(niveles).sort((a, b) => a - b);
  
  for (const nivel of nivelesOrdenados) {
    const columna = document.createElement("div");
    columna.className = "columna-nivel";

    const titulo = document.createElement("h2");
    titulo.textContent = `Nivel ${nivel}`;
    columna.appendChild(titulo);

    niveles[nivel].forEach((materia) => {
      const bloque = crearBloqueMateria(materia);
      columna.appendChild(bloque);
    });

    container.appendChild(columna);
  }
}

function crearBloqueMateria(materia) {
  const bloque = document.createElement("div");
  bloque.className = `materia ${materia.area}`;
  bloque.dataset.id = materia.idUnico; // Usamos el ID único como referencia
  
  if (materiasCompletadas.has(materia.idUnico)) {
    bloque.classList.add("tachada");
  } else if (!puedeTomarse(materia)) {
    bloque.classList.add("bloqueada");
  }

  bloque.addEventListener("click", function() {
    const idMateria = this.dataset.id;
    const materia = materias.find(m => m.idUnico === idMateria);
    
    if (!materia) return;
    
    if (materiasCompletadas.has(idMateria)) {
      materiasCompletadas.delete(idMateria);
    } else {
      if (!puedeTomarse(materia)) {
        const faltantes = (materia.prerequisitos || [])
          .map(p => materias.find(m => normalizarCodigo(m.codigo) === normalizarCodigo(p)))
          .filter(m => m && !materiasCompletadas.has(m.idUnico));
        
        if (faltantes.length > 0) {
          alert(`Prerrequisitos faltantes:\n${faltantes.map(m => m.nombre).join("\n")}`);
        }
        return;
      }
      materiasCompletadas.add(idMateria);
    }
    
    guardarProgreso();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  });

  const tabla = document.createElement("div");
  tabla.className = "info-tabla";
  tabla.innerHTML = `
    <div class="celda">${materia.creditos} CR</div>
    <div class="celda">${materia.ht} HT</div>
    <div class="celda">${materia.hpr} HP</div>
    <div class="celda">${materia.curso || normalizarCodigo(materia.codigo)}</div>
  `;

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  bloque.appendChild(tabla);
  bloque.appendChild(nombre);

  return bloque;
}

function puedeTomarse(materia) {
  if (materiasCompletadas.has(materia.idUnico)) return true;
  if (!materia.prerequisitos || materia.prerequisitos.length === 0) return true;
  
  return materia.prerequisitos.every(prereq => {
    const codigoPrereq = normalizarCodigo(prereq);
    const materiaPrereq = materias.find(m => normalizarCodigo(m.codigo) === codigoPrereq);
    return materiaPrereq && materiasCompletadas.has(materiaPrereq.idUnico);
  });
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

function guardarProgreso() {
  const idsCompletados = Array.from(materiasCompletadas);
  localStorage.setItem("materiasCompletadas", JSON.stringify(idsCompletados));
}

function cargarProgreso() {
  const data = localStorage.getItem("materiasCompletadas");
  if (data) {
    const ids = JSON.parse(data);
    materiasCompletadas = new Set(ids);
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
  const totalMaterias = materias.length;
  const completadas = materiasCompletadas.size;
  const porcentaje = Math.round((completadas / totalMaterias) * 100);
  
  document.getElementById("barra-progreso").style.width = `${porcentaje}%`;
  document.getElementById("texto-progreso").textContent = `${porcentaje}% completado`;
  
  const creditosCompletados = materias
    .filter(m => materiasCompletadas.has(m.idUnico))
    .reduce((sum, m) => sum + (m.creditos || 0), 0);
  
  document.getElementById("total-creditos").textContent = `Créditos completados: ${creditosCompletados}`;
  document.getElementById("total-materias").textContent = `Materias completadas: ${completadas}/${totalMaterias}`;
}

// ... (resto de las funciones para el planificador y PDF se mantienen igual)
/* -------- Planificador Inteligente -------- */
function actualizarPlanificador() {
  const contenedor = document.getElementById("sugerencias-materias");
  contenedor.innerHTML = "";

  // Filtrar materias disponibles
  const disponibles = materias.filter(m => 
    !materiasCompletadas.has(m.codigoNormalizado) && 
    puedeTomarse(m)
  );

  if (disponibles.length === 0) {
    contenedor.innerHTML = `<p class="no-sugerencias">¡Felicidades! Has completado todas las materias disponibles.</p>`;
    return;
  }

  // Calcular peso para cada materia
  const materiasConPeso = disponibles.map(m => ({
    ...m,
    peso: calcularPesoMateria(m)
  })).sort((a, b) => b.peso - a.peso);

  // Generar opciones
  const opciones = [
    generarOpcionInscripcion([...materiasConPeso]),
    generarOpcionInscripcion([...materiasConPeso].reverse())
  ];

  // Mostrar opciones
  opciones.forEach((opcion, i) => {
    const grupo = document.createElement("div");
    grupo.className = "opcion-planificador";
    grupo.innerHTML = `<h3>Opción ${i + 1}:</h3>`;
    
    let creditosTotales = 0;
    
    opcion.forEach(materia => {
      creditosTotales += materia.creditos;
      grupo.innerHTML += `
        <div class="materia-sugerida ${materia.area}">
          <span>${materia.nombre}</span>
          <span>${materia.creditos} cr. (Nivel ${materia.nivel})</span>
        </div>
      `;
    });
    
    grupo.innerHTML += `<div class="total-creditos">Total: ${creditosTotales}/18 créditos</div>`;
    contenedor.appendChild(grupo);
  });
}

function calcularPesoMateria(materia) {
  const desbloqueos = contarDesbloqueos(materia.codigoNormalizado);
  const pesoNivel = 1 / (materia.nivel || 10);
  const pesoCreditos = (materia.creditos || 0) / 4;
  return (desbloqueos * 2) + (pesoNivel * 3) + pesoCreditos;
}

function contarDesbloqueos(codigo) {
  return materias.filter(m => 
    m.prerequisitosNormalizados.includes(codigo) && 
    !materiasCompletadas.has(m.codigoNormalizado)
  ).length;
}

function generarOpcionInscripcion(materiasOrdenadas) {
  const seleccionadas = [];
  let creditosAcumulados = 0;
  const materiasConsideradas = new Set();
  
  for (const materia of materiasOrdenadas) {
    if (materiasConsideradas.has(materia.codigoNormalizado) || 
        creditosAcumulados + materia.creditos > 18) continue;
    
    seleccionadas.push(materia);
    creditosAcumulados += materia.creditos;
    materiasConsideradas.add(materia.codigoNormalizado);
    
    if (creditosAcumulados >= 15) break;
  }
  
  return seleccionadas;
}

/* -------- Exportar como PDF -------- */
function descargarPDF() {
  const element = document.createElement("div");
  element.className = "pdf-container";
  
  // Configurar opciones de PDF
  const opt = {
    margin: 10,
    filename: 'planificacion-mecatronica.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  
  // Generar PDF
  html2pdf().set(opt).from(element).save();
}
