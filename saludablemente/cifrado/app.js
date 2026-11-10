const form = document.getElementById("patientForm");
const birthInput = document.getElementById("nacimiento");
const ageInput = document.getElementById("edad");
const previewDialog = document.getElementById("previewDialog");
const helpDialog = document.getElementById("helpDialog");
const toast = document.getElementById("toast");

function calculateAge(dateValue) {
  if (!dateValue) return "";
  const birth = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age--;
  return age >= 0 ? String(age) : "";
}

birthInput.addEventListener("change", () => {
  ageInput.value = calculateAge(birthInput.value);
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function getValue(name) {
  const field = form.elements.namedItem(name);
  return field ? field.value.trim() : "";
}

function addSummary(label, value, target) {
  if (!value) return;
  const item = document.createElement("div");
  item.className = "summary-item";
  const caption = document.createElement("span");
  caption.textContent = label;
  const content = document.createElement("strong");
  content.textContent = value;
  item.append(caption, content);
  target.append(item);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = getValue("nombre");
  if (!name) {
    form.elements.namedItem("nombre").focus();
    showToast("Escribe el nombre del paciente para continuar.");
    return;
  }

  const summary = document.getElementById("previewSummary");
  summary.replaceChildren();
  addSummary("Nombre", name, summary);
  addSummary("Fecha de nacimiento", getValue("nacimiento"), summary);
  addSummary("Edad", ageInput.value ? `${ageInput.value} años` : "", summary);
  addSummary("Teléfono", getValue("telefono"), summary);
  addSummary("Ciudad", getValue("ciudad"), summary);
  addSummary("Escolaridad", getValue("escolaridad"), summary);
  previewDialog.showModal();
});

document.getElementById("closeDialog").addEventListener("click", () => previewDialog.close());
document.getElementById("editBtn").addEventListener("click", () => previewDialog.close());
document.getElementById("doneBtn").addEventListener("click", () => {
  previewDialog.close();
  showToast("Demostración completada. No se guardó ningún dato.");
});
document.getElementById("helpBtn").addEventListener("click", () => helpDialog.showModal());
document.getElementById("closeHelp").addEventListener("click", () => helpDialog.close());
document.getElementById("closeHelpBottom").addEventListener("click", () => helpDialog.close());

form.addEventListener("reset", () => {
  window.setTimeout(() => {
    ageInput.value = "";
    showToast("Formulario limpio.");
  }, 0);
});

document.querySelectorAll("[data-demo-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showToast("Este módulo puede incorporarse en una siguiente etapa.");
  });
});
