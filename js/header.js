//  document.getElementById("hireme-button").addEventListener("click", () => {
//     const contactSection = document.getElementById("contact");
//     if (contactSection) {
//         contactSection.scrollIntoView({ behavior: "smooth" });
//     }
// });

document.getElementById("coffe-button").addEventListener("click", () => {
    window.open("https://bmc.link/rricajos", "_blank")
});

// Función para obtener y mostrar la hora actual de Barcelona
function showBarcelonaTime() {
    const timeElement = document.getElementById("bcn-time");
    if (timeElement) {
        const barcelonaTime = new Date().toLocaleTimeString("es-ES", {
            timeZone: "Europe/Madrid",
        });
        timeElement.textContent = `${barcelonaTime}`;
    }
}


function convertSecondsToYearsMonthsDays(seconds) {
    const secondsInYear = 31536000; // 60 segundos * 60 minutos * 24 horas * 365 días
    const secondsInMonth = 2592000; // 60 segundos * 60 minutos * 24 horas * 30 días

    const years = Math.floor(seconds / secondsInYear);
    seconds %= secondsInYear;
    const months = Math.floor(seconds / secondsInMonth);
    seconds %= secondsInMonth;
    const days = Math.floor(seconds / 86400); // 60 segundos * 60 minutos * 24 horas

    return `${years}y ${months}m ${days}d`;
}

// https://docs.google.com/spreadsheets/d/1L9FkgU1ubDLcqrNTdkuKtvS83O-Il6OdDRCanNslC8g/edit?usp=sharing
const apiKey = "AIzaSyC_EhDq6fPXIcfuAtM14vB8nAI1H-573M0";
const spreadsheetId = "1L9FkgU1ubDLcqrNTdkuKtvS83O-Il6OdDRCanNslC8g";
const workCellRange = "B3";
const studyCellRange = "B2";


const workUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${workCellRange}?key=${apiKey}`;

fetch(workUrl)
    .then(response => response.json())
    .then(data => {
        if (data && data.values && data.values[0] && data.values[0][0]) {
            const seconds = parseFloat(data.values[0][0]);
            const formattedResult = convertSecondsToYearsMonthsDays(seconds);
            document.getElementById("timming-work").innerText = formattedResult;
        } else {
            document.getElementById("timming-work").innerText = "0";
        }
    })
    .catch(error => {
        console.error('Error al obtener el valor:', error);
        document.getElementById("timming-work").innerText = "Error";
    });


    
const studyWork = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${studyCellRange}?key=${apiKey}`;

fetch(studyWork)
    .then(response => response.json())
    .then(data => {
        if (data && data.values && data.values[0] && data.values[0][0]) {
            const seconds = parseFloat(data.values[0][0]);
            const formattedResult = convertSecondsToYearsMonthsDays(seconds);
            document.getElementById("timming-study").innerText = formattedResult;
        } else {
            document.getElementById("timming-study").innerText = "0";
        }
    })
    .catch(error => {
        console.error('Error al obtener el valor:', error);
        document.getElementById("timming-study").innerText = "Error";
    });