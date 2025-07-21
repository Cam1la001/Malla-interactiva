let materias = [];
let materiasCompletadas = new Set();
let filtroNivelActual = 0;

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Cargar datos
    const response = await fetch("malla.json");
    if (!response.ok) throw new Error("Error al cargar malla.json");
    materias = await response.json();
    
    // Normalizar códigos y verificar prerrequisitos
    normalizarCodigosMaterias();
    verificarPrerrequisitos();
    
    // Configurar eventos
    document.getElementById("guardar-btn").addEventListener("click", guardarProgreso);
    document.getElementById("limpiar-btn").addEventListener("click", limpiarProgreso);
    document.getElementById("exportar-btn").addEventListener("click", descargarPDF);
    document.getElementById("aplicar-filtro").addEventListener("click", aplicarFiltroNivel);
    
    // Inicializar
    cargarProgreso();
    renderMalla();
    actualizarPlanificador();
    actualizarResumenProgreso();
  } catch (error) {
    console.error("Error inicial:", error);
    alert("Error al cargar los datos. Ver consola para detalles.");
  }
});

// Normaliza todos los códigos en las materias y prerrequisitos
function normalizarCodigosMaterias() {
  materias.forEach(materia => {
    // Normalizar código principal
    materia.codigoNormalizado = normalizarCodigo(materia.codigo || materia.nombre);
    
    // Normalizar prerrequisitos
    if (materia.prerequisitos && Array.isArray(materia.prerequisitos)) {
      materia.prerequisitosNormalizados = materia.prerequisitos.map(normalizarCodigo).filter(Boolean);
    } else {
      materia.prerequisitosNormalizados = [];
    }
  });
}

// Verifica que todos los prerrequisitos existan
function verificarPrerrequisitos() {
  const codigosExistentes = new Set(materias.map(m => m.codigoNormalizado));
  let problemas = 0;

  materias.forEach(materia => {
    materia.prerequisitosNormalizados.forEach(prereq => {
      if (!codigosExistentes.has(prereq)) {
        console.warn(`Prerrequisito no encontrado: "${prereq}" en "${materia.nombre}"`);
        problemas++;
      }
    });
  });

  if (problemas > 0) {
    console.warn(`Total de problemas con prerrequisitos: ${problemas}`);
  }
}

// Normaliza un código (elimina espacios, caracteres especiales, etc.)
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
    const materiasNivel = niveles[nivel].sort((a, b) => 
      a.codigoNormalizado.localeCompare(b.codigoNormalizado)
    );

    materiasNivel.forEach((materia) => {
      const bloque = crearBloqueMateria(materia);
      if (bloque) columna.appendChild(bloque);
    });

    container.appendChild(columna);
  }
}

function crearBloqueMateria(materia) {
  const bloque = document.createElement("div");
  bloque.className = `materia ${materia.area}`;
  
  // Configurar estados
  if (materiasCompletadas.has(materia.codigoNormalizado)) {
    bloque.classList.add("tachada");
  } else if (!puedeTomarse(materia)) {
    bloque.classList.add("bloqueada");
  }

  // Configurar evento de clic
  bloque.addEventListener("click", function() {
    // Alternar estado
    if (materiasCompletadas.has(materia.codigoNormalizado)) {
      materiasCompletadas.delete(materia.codigoNormalizado);
    } else {
      // Verificar si se puede tomar
      if (!puedeTomarse(materia)) {
        const faltantes = materia.prerequisitosNormalizados
          .filter(p => !materiasCompletadas.has(p));
        
        if (faltantes.length > 0) {
          alert(`Para tomar "${materia.nombre}" necesitas completar:\n${faltantes.join("\n")}`);
        }
        return;
      }
      materiasCompletadas.add(materia.codigoNormalizado);
    }
    
    // Guardar y actualizar
    guardarProgreso();
    renderMalla(); // Vuelve a renderizar toda la malla
    actualizarPlanificador();
    actualizarResumenProgreso();
  });

  // Crear contenido
  const tabla = document.createElement("div");
  tabla.className = "info-tabla";
  tabla.innerHTML = `
    <div class="celda">${materia.creditos} CR</div>
    <div class="celda">${materia.ht} HT</div>
    <div class="celda">${materia.hpr} HP</div>
    <div class="celda">${materia.curso || materia.codigoNormalizado}</div>
  `;

  const nombre = document.createElement("div");
  nombre.className = "nombre-materia";
  nombre.textContent = materia.nombre;

  // Tooltip con prerrequisitos
  if (materia.prerequisitosNormalizados.length > 0) {
    bloque.title = `Prerrequisitos: ${materia.prerequisitosNormalizados.join(", ")}`;
  }

  bloque.appendChild(tabla);
  bloque.appendChild(nombre);

  return bloque;
}

function puedeTomarse(materia) {
  // Si ya está completada, se puede desmarcar
  if (materiasCompletadas.has(materia.codigoNormalizado)) return true;
  
  // Si no tiene prerrequisitos, se puede tomar
  if (materia.prerequisitosNormalizados.length === 0) return true;
  
  // Verificar todos los prerrequisitos
  return materia.prerequisitosNormalizados.every(prereq => 
    materiasCompletadas.has(prereq)
  );
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
  const codigosCompletados = Array.from(materiasCompletadas);
  try {
    localStorage.setItem("materiasCompletadas", JSON.stringify(codigosCompletados));
  } catch (e) {
    console.error("Error al guardar progreso:", e);
  }
}

function cargarProgreso() {
  try {
    const data = localStorage.getItem("materiasCompletadas");
    if (data) {
      const codigos = JSON.parse(data);
      materiasCompletadas = new Set(codigos.filter(c => typeof c === 'string' && c.length > 0));
    }
  } catch (e) {
    console.error("Error al cargar progreso:", e);
    materiasCompletadas = new Set();
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
  const totalMaterias = materias.filter(m => m.codigoNormalizado).length;
  const completadas = materiasCompletadas.size;
  const porcentaje = totalMaterias > 0 ? Math.round((completadas / totalMaterias) * 100) : 0;
  
  // Actualizar barra de progreso
  document.getElementById("barra-progreso").style.width = `${porcentaje}%`;
  document.getElementById("texto-progreso").textContent = `${porcentaje}% completado`;
  
  // Calcular créditos completados
  const creditosCompletados = materias
    .filter(m => materiasCompletadas.has(m.codigoNormalizado))
    .reduce((sum, m) => sum + (m.creditos || 0), 0);
  
  // Actualizar textos
  document.getElementById("total-creditos").textContent = `Créditos completados: ${creditosCompletados}`;
  document.getElementById("total-materias").textContent = `Materias completadas: ${completadas}/${totalMaterias}`;
}

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
