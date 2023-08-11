
function oopenMoreInfo(listItemId){
    let item = document.getElementById(listItemId);

    if (item.style.display === "none") {
        item.style.display = "block";
    } else {
        item.style.display = "none";
    }
    


    
}


function oopen(evt, name) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(name).style.display = "block";
    evt.currentTarget.className += " active";

}



function hideHiddenLinks() {
    const linksContainer = document.getElementById('links');
    if (!linksContainer) {
        return; // Salir de la función si el elemento no existe
    }

    const hiddenLinks = linksContainer.querySelectorAll('.hidden');
    hiddenLinks.forEach(link => {
        link.style.display = 'none';
    });

    const showMoreButton = document.querySelector('.show-more-button');

    if (hiddenLinks.length === 0) {
        showMoreButton.style.display = 'none';
    } else {
        showMoreButton.style.display = 'block';
    }
}

function toggleHiddenLinks() {
    const linksContainer = document.getElementById('links');
    if (!linksContainer) {
        return; // Salir de la función si el elemento no existe
    }

    const hiddenLinks = linksContainer.querySelectorAll('.hidden');
    hiddenLinks.forEach(link => {
        link.style.display = link.style.display === 'none' ? 'block' : 'none';
    });

    const showMoreButton = document.querySelector('.show-more-button');

    if (hiddenLinks.length === 0) {
        showMoreButton.style.display = 'none';
    }
}