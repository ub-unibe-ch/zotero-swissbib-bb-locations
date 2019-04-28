///////////////
// Init
////////////////

function swissbibBBLocationLookupInitialize () {
	// Hilfsvariable implizit global, ist das eine gute Idee?
	// Aktuell brauche ich die Zähler eigentlich nicht...
	itemWithoutISBN = 0;
	itemWithLocation = 0;
	itemWithoutLocation = 0;

	// Bibliotheken
	kurierbibliothekenUBBe = [
		"B400", //Speicher
		"B452", //FBB
		"B465", //JBB
		"B500", //vonRoll
		"B404", //BMü
		"B410", //BTO
		"B415", //SOB
		];
		
	libraryCodeUBBeOnline = "B405";
	
	// Was mit ExWi machen?

		
	// SRU-URL
	sruPrefix = "http://sru.swissbib.ch/sru/search/bbdb?query=+dc.identifier+any+";
	sruSuffix = "&operation=searchRetrieve&recordSchema=info%3Asrw%2Fschema%2F1%2Fmarcxml-v1.1-light&maximumRecords=10&x-info-10-get-holdings=true&startRecord=0&recordPacking=XML&availableDBs=defaultdb&sortKeys=Submit+query";

	// Tags & Strings
	noResultsInSwissbibBBText = "Keine Ergebnisse";
	isWithoutISBNText = "IDS BB Standortcheck: ohne (gültige) ISBN";
	isNotInUBBEText = 'IDS BB Standortcheck: UB Bern nein';
	isInUBBeText= 'IDS BB Standortcheck: UB Bern ja';
	isinUBBeKurierbibText = 'IDS BB Standortcheck: UB Bern Kurierbibliothek';
	isInUBBeOnlineText = 'IDS BB Standortcheck: UB Bern Online';
	idsbbBEpossibly = 'IDS BB Standortcheck: UB Bern eventuell';

	tags = [isInUBBeOnlineText, isWithoutISBNText, isInUBBeText, isinUBBeKurierbibText, isNotInUBBEText, idsbbBEpossibly];

};

///////////////
// Funktionen
///////////////

// ISBN überprüfen
function isValidIsbn(isbn) {
	// ISBN überprüfen
	// Ist die Prüfziffer korrekt?
	// Korrekte Prüfziffer ist keine Garantie für korrekte ISBN, schliesst aber einige Fehlerquellen aus
	
	let lastDigit,
		currentDigit,
		checksum;
	
	// ISBN Rohdaten aufräumen: Alles weg ausser 0-9 und X;
    isbn = isbn.replace(/[^0-9X]/gi, '');
	// Ist die ISBN entweder 10 oder 13 Stellen lang? Falls nein => keine ISBN
    if (isbn.length != 10 && isbn.length != 13) {
        return false;
    }
	
	// Falls ja: letzte Ziffer holen
	lastDigit = isbn[isbn.length-1].toUpperCase();

	// Prüfzimmern berechnen
	// siehe https://de.wikipedia.org/wiki/Internationale_Standardbuchnummer
	
	// ISBN-13
    if (isbn.length == 13) {
		checksum = 	
		  10 - 
		  (
			(
			  parseInt(isbn[0]) + parseInt(isbn[2]) + parseInt(isbn[4]) + 
			  parseInt(isbn[6]) +	parseInt(isbn[8]) + parseInt(isbn[10])
			) 
			+ 
			3 * (
			  parseInt(isbn[1]) + parseInt(isbn[3]) + parseInt(isbn[5]) + 
			  parseInt(isbn[7]) +	parseInt(isbn[9]) + parseInt(isbn[11])
			) 
			% 10
		  ) % 10;
    }

	// ISBN-10
    if (isbn.length == 10) {
        let multiplicator = [1,2,3,4,5,6,7,8,9];
        checksum = 
		  (
			parseInt(isbn[0]) * multiplicator[0] +
			parseInt(isbn[1]) * multiplicator[1] +
			parseInt(isbn[2]) * multiplicator[2] +
			parseInt(isbn[3]) * multiplicator[3] +
			parseInt(isbn[4]) * multiplicator[4] +
			parseInt(isbn[5]) * multiplicator[5] +
			parseInt(isbn[6]) * multiplicator[6] +
			parseInt(isbn[7]) * multiplicator[7] +
			parseInt(isbn[8]) * multiplicator[8]
		  ) % 11;
        // Statt Checksum 10 wird X verwendet
        if (checksum == 10) {
            checksum = 'X';
        }
    }
	
// entspricht die letzte Ziffer der berechneten Prüfzimmer?
return (checksum == lastDigit);
}


// Tags hinzufügen je nach Status; ausserdem die Zähler hochsetzen
function ApplyTags(item,isInUBBe,isinUBBeKurierbib,isInUBBeOnline,isWithoutISBN) {
	// eventuell vorhandene alte Tags löschen
	for (const tag of tags) {
		if (item.hasTag(tag)) {
			item.removeTag(tag);
		}
	}
	// neue Tags setzen
	// keine ISBN
	if (isWithoutISBN == true) {
    item.addTag(isWithoutISBNText);
	  itemWithoutISBN++;
	}
	// kein Standort (aber ISBN)
	if ((isInUBBe == false) && (isWithoutISBN == false)) {
    item.addTag(isNotInUBBEText);
	  itemWithoutLocation++;
	}
	// Standort an UB Bern
  if (isInUBBe == true) {
    item.addTag(isInUBBeText);
	  itemWithLocation++;
	}
	// In UB Bern Kurierbibliothek
  if (isinUBBeKurierbib == true) {
    item.addTag(isinUBBeKurierbibText);
	  itemWithLocation++;
	}
	// An UB Bern Online verfügbar
	if (isInUBBeOnline == true) {
		item.addTag(isInUBBeOnlineText);
	}
  if (status=="eventuell") {
    item.addTag(idsbbBEpossibleText);
  }
}

function printResults() {
	results = items.length + " Einträge verarbeitet\n" + itemWithLocation + " Einträge mit Standort an UB Bern\n" + itemWithoutLocation + " Einträge ohne Standort an UB Bern\n" + itemWithoutISBN + " Einträge ohne ISBN"; 
	alert(results);
}

//XML Parsen
function processXML(item,xml) {
	// Schalter setzen
	let isInUBBe = false;
  let isInUBBeOnline = false;
	let isinUBBeKurierbib = false;
	let isWithoutISBN = false;
	// Formatierung der Ergebnisse
	let date = new Date();
	let currentDate = date.getFullYear() + "-" + date.getMonth() + "-" + date.getDate() + " (" + date.getHours() + ":"  + date.getMinutes() + ":" + date.getSeconds() + ")";
	let holdingsFormatted = currentDate + " Bestand Swissbib BB\n=======================================";
	let xmlResponse = xml.responseXML;
	// Haben wir Ergebnisse in Swissbib BB?
	// Nein =>
	if (xmlResponse.querySelector("searchRetrieveResponse > numberOfRecords").textContent == "0") {
		holdingsFormatted += ("\n" + noResultsInSwissbibBBText);
	// Ja =>
	} else {
		let holdings = xmlResponse.querySelectorAll("holdings > datafield[tag='949']");
		for (const holding of holdings) {
			let holdingLibraryCode, 
				holdingLibrary, 
				holdingLibraryLocation, 
				holdingLibraryConditions, 
				holdingVolumeInformation, 
				holdingFormatted;
			if ((holding.querySelector("subfield[code='B']").textContent) == "SNL") {
				// Special handling for SNL
				holdingLibrary = holding.querySelector("subfield[code='B']").textContent;
				holdingFormatted = "\n" + holdingLibrary;
			} 
			else {
				holdingLibraryCode = holding.querySelector("subfield[code='F']").textContent;
				if (holding.querySelector("subfield[code='0']")) {
					holdingLibrary = holding.querySelector("subfield[code='0']").textContent;
				} else {
					if (holdingLibraryCode == "B405") {
						holdingLibrary = "Bern UB Online";
					} else if (holdingLibraryCode == "A145") {
						holdingLibrary = "Basel Online";
					} else {
						holdingLibrary = holdingLibraryCode;
					}
				}
				if (holding.querySelector("subfield[code='1']")) 
					holdingLibraryLocation = holding.querySelector("subfield[code='1']").textContent;
				if (holding.querySelector("subfield[code='5']"))
					holdingLibraryConditions = holding.querySelector("subfield[code='5']").textContent;
				if (holding.querySelector("subfield[code='z']")) {
					holdingVolumeInformation = holding.querySelector("subfield[code='z']").textContent;
				}
				holdingFormatted = "\n" + holdingLibrary;
				if (holdingLibraryLocation) holdingFormatted = holdingFormatted + ", " + holdingLibraryLocation;
				if (holdingLibraryConditions) holdingFormatted = holdingFormatted + ", " + holdingLibraryConditions;
				if (holdingVolumeInformation) holdingFormatted = holdingFormatted + " (=> " + holdingVolumeInformation + ")";
			}
			// Aktuelles Holding zur Holdingliste hinzufügen
			holdingsFormatted += holdingFormatted;
			
			// In UB Bern?
			// Irgendwo in UB Bern oder Bern Online
			if (holdingLibrary.startsWith("Bern UB") || (holdingLibrary == "B405")) isInUBBe = true;
			// Kurierbibliothek
			if (kurierbibliothekenUBBe.includes(holdingLibraryCode)) isinUBBeKurierbib = true;
			// Online spezifisch
			if (holdingLibrary == libraryCodeUBBeOnline || holdingLibrary == "Bern UB Online") isInUBBeOnline = true;
		}
	}

	// Tags setzen
	ApplyTags(item,isInUBBe,isinUBBeKurierbib,isInUBBeOnline,isWithoutISBN);

	// Holdings speichern
	// Im Feld Zusammenfassung
	let oldAbstractNote = item.getField('abstractNote');
	item.setField('abstractNote', holdingsFormatted + "\n============================\n\n" + oldAbstractNote);
	// Oder in Notiz?
	// var note = new Zotero.Item('note');
	// note.setNote(holdingsFormatted);
	// ??? VAR1 note.parentKey = item.key;
  // ??? ODER note.parentID = item.id;
	// note.saveTx();
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

async function swissbibBBLocationLookup() {
	swissbibBBLocationLookupInitialize();
	// Zuerst holen wir die aktuell ausgewählten Titel
	var ZoteroPane = Zotero.getActiveZoteroPane();
	var selectedItems = ZoteroPane.getSelectedItems();

	// Alle nicht-Buch-Titel werden herausgefiltert
	var items = selectedItems.filter(item => item.itemTypeID == Zotero.ItemTypes.getID('book'));
	// Loop durch die Items
	for (const item of items) {
		let isbns;
		if (item.getField('ISBN')) {
			isbns = item.getField('ISBN').split(" ");
		}
		if (!(item.getField('ISBN')) || !(isbns.some(isValidIsbn) == true)) {
			// Keine (oder keine gültige) ISBN vorhanden
			let isInUBBe = false;
			let isInUBBeOnline = false;
			let isinUBBeKurierbib = false;
			let isWithoutISBN = true;
			ApplyTags(item,isInUBBe,isinUBBeKurierbib,isInUBBeOnline,isWithoutISBN);
			await item.saveTx();
		} else {
			// Mindestens eine gültige ISBN vorhanden
			// SRU-Request
			let URL = sruPrefix + isbns.join("+") + sruSuffix;
			let sru = new XMLHttpRequest();
			//sru.onreadystatechange = async function() {
			sru.onreadystatechange = async function() {
					if (this.readyState == 4 && this.status == 200) {
					await processXML(item,this);
					await item.saveTx();
					//item.saveTx();
					//if () {
					//	printResults();
					//}
			}; 
			};
			sru.open("GET", URL, true);
			sru.send();
		}
	};
};