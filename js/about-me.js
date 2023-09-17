
// function toggleIconYScale(collapsibleId) {
//     let element = document.getElementById(collapsibleId);
//     element.classList.toggle("collapsible-active");
//     element.classList.toggle("collapsible-not-active");
   

//     // Convierte la lista de clases en un array para poder iterar sobre ellas
//     let arr = Array.from(element.classList);

//     // Itera a través del array de clases y haz lo que necesites con cada una
//     for (let i = 0; i < arr.length; i++) {
//         if (arr[i] == "collapsible-active") {

//         }
//     }
// }

// function oopenMoreInfo(listItemId) {
//     let item = document.getElementById(listItemId);

//     if (item.style.display === "none") {
//         item.style.display = "initial";


//     } else {
//         item.style.display = "none";

//     }




// }


// function oopen(evt, name) {
//     // Declare all variables
//     var i, tabcontent, tablinks;

//     // Get all elements with class="tabcontent" and hide them
//     tabcontent = document.getElementsByClassName("tabcontent");
//     for (i = 0; i < tabcontent.length; i++) {
//         tabcontent[i].style.display = "none";
//     }

//     // Get all elements with class="tablinks" and remove the class "active"
//     tablinks = document.getElementsByClassName("tablinks");
//     for (i = 0; i < tablinks.length; i++) {
//         tablinks[i].className = tablinks[i].className.replace(" active", "");
//     }

//     // Show the current tab, and add an "active" class to the button that opened the tab
//     document.getElementById(name).style.display = "block";
//     evt.currentTarget.className += " active";

// }



// function hideHiddenLinks() {
//     const linksContainer = document.getElementById('links');
//     if (!linksContainer) {
//         return; // Salir de la función si el elemento no existe
//     }

//     const hiddenLinks = linksContainer.querySelectorAll('.hidden');
//     hiddenLinks.forEach(link => {
//         link.style.display = 'none';
//     });

//     const showMoreButton = document.querySelector('.show-more-button');

//     if (hiddenLinks.length === 0) {
//         showMoreButton.style.display = 'none';
//     } else {
//         showMoreButton.style.display = 'block';
//     }
// }

// function toggleHiddenLinks() {
//     const linksContainer = document.getElementById('links');
//     if (!linksContainer) {
//         return; // Salir de la función si el elemento no existe
//     }

//     const hiddenLinks = linksContainer.querySelectorAll('.hidden');
//     hiddenLinks.forEach(link => {
//         link.style.display = link.style.display === 'none' ? 'block' : 'none';
//     });

//     const showMoreButton = document.querySelector('.show-more-button');

//     if (hiddenLinks.length === 0) {
//         showMoreButton.style.display = 'none';
//     }
// }