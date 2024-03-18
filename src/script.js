const buListbox = document.getElementById("business-unit-listbox");

document.getElementById("generateBtn").addEventListener("click", generate);

// Event listener for bu-listbox
let selectedBuId;
let selectedBuName;
buListbox.addEventListener("change", (event) => {
  selectedBuId = event.target.value;

  // Get the selected gux-option's innerHTML
  var selectedOption = Array.from(
    buListbox.querySelectorAll("gux-option")
  ).find((option) => option.value === selectedBuId);
  selectedBuName = selectedOption ? selectedOption.innerHTML : "";

  // Remove <!----> if found in selectedBuName
  selectedBuName = selectedBuName.replace(/<!---->/g, "");

  terminal(
    "INFO",
    `Selected business unit: ${selectedBuName} (${selectedBuId})`
  );
});

function init() {
  // function to get business units
  function getBusinessUnits() {
    // Add your getBusinessUnits logic here
  }

  const businessUnits = getBusinessUnits();

  // sort data by name (not case sensitive)
  businessUnits.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  businessUnits.array.forEach((element) => {});
}

async function getForecasts() {
  // Add your getForecasts logic here
}

function generate() {
  // Add your generate logic here
}
