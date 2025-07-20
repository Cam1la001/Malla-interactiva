let materias = [];
let completadas = JSON.parse(localStorage.getItem("materiasHechas")) || [];

fetch("data/materias.json")
  .then(res => res.json())
  .then(data => {
    materias = data;
    render();
  });

function render() {
  const container = document.getElementById("niveles-container");
  container.innerHTML = "";

  const niveles = [...new Set(materias.map(m => m.nivel))].sort((a, b) => a - b);

  niveles.forEach(nivel => {
    const col = document.createElement("div");
    col.className = "columna-nivel";
    col.innerHTML = `<h2>Nivel ${nivel}</h2>`;

    const materiasNivel = materias.filter(m => m.nivel === nivel);
    materiasNivel.forEach(materia => {
      const bloqueada = !materia.prerequisitos.every(pr => completadas.includes(pr));
      const divMateria = document.createElement("div");

      divMateria.className = `materia ${materia.area}`;
      if (completadas.includes(materia.codigo)) divMateria.classList.add("tachada");
      else if (bloqueada) divMateria.classList.add("bloqueada");

      divMateria.textContent = `${materia.codigo}\n${materia.nombre}`;
      divMateria.onclick = () => toggleMateria(materia.codigo);

      col.appendChild(divMateria);
    });

    container.appendChild(col);
  });
}

function toggleMateria(codigo) {
  const index = completadas.indexOf(codigo);
  if (index >= 0) {
    completadas.splice(index, 1);
  } else {
    completadas.push(codigo);
  }
  localStorage.setItem("materiasHechas", JSON.stringify(completadas));
  render();
}
