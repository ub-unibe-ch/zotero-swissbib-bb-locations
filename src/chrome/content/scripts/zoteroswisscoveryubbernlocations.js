// Startup -- load Zotero and constants
if (typeof Zotero === 'undefined') {
    Zotero = {};
}

// Create a namespace for our functions and variables
Zotero.swisscoveryubbernlocations = {};



/// ///////////////////
/// Preference-Handling
///////////////////////

Zotero.swisscoveryubbernlocations.getPref = function (pref) {
    return Zotero.Prefs.get('extensions.swisscoveryubbernlocations.' + pref, true);
}

Zotero.swisscoveryubbernlocations.setPref = function (pref, value) {
    return Zotero.Prefs.set('extensions.swisscoveryubbernlocations.' + pref, value, true);
};


/**
 * Open Swisscovery UB Bern preference window
 */

Zotero.swisscoveryubbernlocations.openPreferenceWindow = function(paneID, action) {
    var io = {pane: paneID, action: action};
    window.openDialog('chrome://zoteroswisscoveryubbernlocations/content/options.xul',
        'swisscoveryubbernlocations-pref',
        'chrome,titlebar,toolbar,centerscreen' + Zotero.Prefs.get('browser.preferences.instantApply', true) ? 'dialog=no' : 'modal', io
    );
};


///////////////
// Init
////////////////

Zotero.swisscoveryubbernlocations.Initialize = function () {
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
		"B555", //BMi
		"B404", //BMü
		"B410", //BTO
		"B415", //SOB
		"B410", //Unitobler
		];
		
	libraryCodeUBBeOnline = "B405";
	
	
	// SRU-URL

	// mögliche Parameter

	
    // https://slsp-ube.alma.exlibrisgroup.com/view/sru/41SLSP_UBE?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.isbn=9783863214159
	//sruPrefix = "https://slsp-ube.alma.exlibrisgroup.com/view/sru/41SLSP_UBE?version=1.2&operation=searchRetrieve&recordSchema=marcxml&query=alma.isbn=";
	// sruPrefix holen wir neu über die prefs
	sruPrefix = Zotero.swisscoveryubbernlocations.getPref("sruurl");
	apiKey = Zotero.swisscoveryubbernlocations.getPref("apikey");
	targetField = Zotero.swisscoveryubbernlocations.getPref("targetField");

	
	// sruSuffix braucht es nicht mehr.
	//sruSuffix = "&operation=searchRetrieve&recordSchema=info%3Asrw%2Fschema%2F1%2Fmarcxml-v1.1-light&maximumRecords=10&x-info-10-get-holdings=true&startRecord=0&recordPacking=XML&availableDBs=defaultdb&sortKeys=Submit+query";


	// Tags & Strings
	noResultsInSwissbibBBText = "Keine Ergebnisse";
	isWithoutISBNText = "UB Bern Standortcheck: ohne (gültige) ISBN";
	isNotInUBBEText = 'UB Bern Standortcheck: nein';
	isInUBBeText= 'UB Bern Standortcheck: ja';
	isinUBBeKurierbibText = 'UB Bern Standortcheck: Kurierbibliothek';
	isInUBBeOnlineText = 'UB Bern Standortcheck: Online';
	isInUBBeOnlineViaEBAText = 'UB Bern Standortcheck: Online via EBA';
	idsbbBEpossibly = 'UB Bern Standortcheck: eventuell';

	tags = [isInUBBeOnlineText, isWithoutISBNText, isInUBBeText, isinUBBeKurierbibText, isNotInUBBEText, idsbbBEpossibly];

};

///////////////
// Funktionen
///////////////

// ISBN überprüfen
Zotero.swisscoveryubbernlocations.isValidIsbn = function (isbn) {
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
		let sum = 
			(
			  parseInt(isbn[0]) + parseInt(isbn[2]) + parseInt(isbn[4]) + 
			  parseInt(isbn[6]) +	parseInt(isbn[8]) + parseInt(isbn[10])
			) 
			+ 3 * 
			(
			  parseInt(isbn[1]) + parseInt(isbn[3]) + parseInt(isbn[5]) + 
			  parseInt(isbn[7]) +	parseInt(isbn[9]) + parseInt(isbn[11])
			);			
		checksum =   (10 - (sum % 10)) % 10;
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
Zotero.swisscoveryubbernlocations.ApplyTags = function (item,isInUBBe,isinUBBeKurierbib,isInUBBeOnline,isInUBBeOnlineViaEBA,isWithoutISBN) {
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
	// An UB Bern Online via EBA
	if (isInUBBeOnlineViaEBA == true) {
		item.addTag(isInUBBeOnlineViaEBAText);
	}
  if (status=="eventuell") {
    item.addTag(idsbbBEpossibleText);
  }
}

Zotero.swisscoveryubbernlocations.printResults = function () {
	results = items.length + " Einträge verarbeitet\n" + itemWithLocation + " Einträge mit Standort an UB Bern\n" + itemWithoutLocation + " Einträge ohne Standort an UB Bern\n" + itemWithoutISBN + " Einträge ohne ISBN"; 
	alert(results);
}

Zotero.swisscoveryubbernlocations.getItemPolicy = async function (BibRecordID, HoldingID) {
    // https://api-eu.hosted.exlibrisgroup.com/almaws/v1/bibs/99116716250105511/holdings/22163616910005511/items?format=json&apikey=
	let url = "https://api-eu.hosted.exlibrisgroup.com/almaws/v1/bibs/" + BibRecordID + "/holdings/" + HoldingID + "/items?format=json&apikey=" + apiKey;
	response = await fetch(url);
	parsed = await response.json();
	let policy;
	if (parsed.item === undefined) {
		policy = "Leihbedingungen nicht verfügbar";
	} else {
		policy = await parsed.item[0].item_data.policy.desc;
	}
	return policy;
}


//XML Parsen
Zotero.swisscoveryubbernlocations.processXML = async function (item,xml) {
	// Schalter setzen
	let isInUBBe = false;
    let isInUBBeOnline = false;
	let isInUBBeOnlineViaEBA = false;
	let isinUBBeKurierbib = false;
	let isWithoutISBN = false;
	// Formatierung der Ergebnisse
	let date = new Date();
	let thisMonth = date.getMonth() + 1;
	let currentDate = date.getFullYear() + "-" + thisMonth + "-" + date.getDate() + " (" + date.getHours() + ":"  + date.getMinutes() + ":" + date.getSeconds() + ")";
	let holdingsFormatted = currentDate + " Bestand Swisscovery UB Bern\n=======================================";
	//let printHoldingsFormatted = "\n\n" + "Print-Bestände\n----------------------------------";
	//let eHoldingsFormatted = "\n\n" + "Elektronische Bestände\n----------------------------------";
	let printHoldingsFormatted = "";
	let eHoldingsFormatted = "";
	let xmlResponse = xml.responseXML;
	// Haben wir Ergebnisse in Swissbib BB?
	// Nein =>
	if (xmlResponse.querySelector("searchRetrieveResponse > numberOfRecords").textContent == "0") {
		holdingsFormatted += ("\n" + noResultsInSwissbibBBText);
	// Ja =>
	} else {
		if (xmlResponse.querySelector("datafield[tag='AVE']")) {
			let eholdings = xmlResponse.querySelectorAll("datafield[tag='AVE']");
			for (const eholding of eholdings) {
				let eholdingAvailability = (eholding.querySelector("subfield[code='e']").textContent == "Available") ? "Online verfügbar" : "Online nicht verfügbar";
				let eholdingZones = eholding.querySelectorAll("subfield[code='b']");
				let eholdingPackage = (eholding.querySelector("subfield[code='m']")) ? ", " + eholding.querySelector("subfield[code='m']").textContent : ", kein Paketkauf"
				let eholdingZonesString = "";
				for (const zone of eholdingZones) {
					eholdingZonesString = eholdingZonesString + ", " + zone.textContent;
				}
				let eHoldingFormatted = `\n${eholdingAvailability}${eholdingZonesString}${eholdingPackage}`;
				eHoldingsFormatted += eHoldingFormatted;
				if (eholdingAvailability == "Online verfügbar") {
					if (!eholdingPackage.includes('TEMP')) {
						isInUBBeOnline = true;
						isInUBBe = true;
					} else {
						isInUBBeOnlineViaEBA = true;
					}
					
				}

				// TODO Tags setzen

				//TODO 2: EBAs verarbeitung
				// So müsste es gehen: eholdingPackage.includes('EBA')
				/* let example = "Example String!";
				let ourSubstring = "Example";

				if (example.includes(ourSubstring)) {
					console.log("The word Example is in the string.");
				} else {
					console.log("The word Example is not in the string.");
				}*/
			}
		}
		else {
			eHoldingsFormatted += "\nKeine elektronischen Bestände vorhanden";
		}
		if (xmlResponse.querySelector("datafield[tag='AVA']")) {
		let holdings = xmlResponse.querySelectorAll("datafield[tag='AVA']");
		for (const holding of holdings) {
			var holdingLibraryCode, 
				holdingLibrary, 
				holdingLibraryViaRapido,
				holdingLibraryLocation,
				holdingFormatted,
				holdingItemPolicy,
				holdingHoldingsID, // subfield 8
				holdingBibRecordID; // subfield 0
				//
				holdingLibraryCode = holding.querySelector("subfield[code='b']").textContent;
				if (holding.querySelector("subfield[code='q']")) {
					holdingLibrary = holding.querySelector("subfield[code='q']").textContent;
				} else {
					if (holdingLibraryCode == "B405") {
						holdingLibrary = "Bern UB Online";
					} else if (holdingLibraryCode == "A145") {
						holdingLibrary = "Basel Online";
					} else {
						holdingLibrary = holdingLibraryCode;
					}
				}
				if (holding.querySelector("subfield[code='j']")) 
				holdingLibraryViaRapido = holding.querySelector("subfield[code='j']").textContent == "RS_BORROW";
				if (holding.querySelector("subfield[code='c']")) 
					holdingLibraryLocation = holding.querySelector("subfield[code='c']").textContent;
					if (holdingLibraryLocation.startsWith('Borrowing Location')) holdingLibraryLocation += " (via Rapido)";
				if (holding.querySelector("subfield[code='0']")) 
					holdingBibRecordID = holding.querySelector("subfield[code='0']").textContent;
				if (holding.querySelector("subfield[code='8']")) 
					holdingHoldingsID = holding.querySelector("subfield[code='8']").textContent;
				//
				if (apiKey != "") holdingItemPolicy = await Zotero.swisscoveryubbernlocations.getItemPolicy (holdingBibRecordID, holdingHoldingsID)
					// hier haben wir ein Problem mit dem Scoping der Variablen...
					// wie bekomme ich die Variable holdingFormatted nach aussen?
				holdingFormatted = "\n" + holdingLibrary;
				if (holdingLibraryLocation) holdingFormatted = holdingFormatted + ", " + holdingLibraryLocation;
				if (holdingItemPolicy) holdingFormatted = holdingFormatted + ", " + holdingItemPolicy
				// Aktuelles Holding zur Holdingliste hinzufügen
			    printHoldingsFormatted += holdingFormatted;			

			// In UB Bern?
			// Irgendwo in UB Bern oder Bern Online
			if ((holdingLibrary.startsWith("Bern UB") && !(holdingLibraryViaRapido)) || (holdingLibrary == "B405")) isInUBBe = true;
			// Kurierbibliothek
			if (kurierbibliothekenUBBe.includes(holdingLibraryCode) && !(holdingLibraryViaRapido)) isinUBBeKurierbib = true;
		}}
		else {
			printHoldingsFormatted += "\nKeine Printbestände vorhanden";
		}
		holdingsFormatted = holdingsFormatted + printHoldingsFormatted + eHoldingsFormatted;
	}

	// Tags setzen
	Zotero.swisscoveryubbernlocations.ApplyTags(item,isInUBBe,isinUBBeKurierbib,isInUBBeOnline,isInUBBeOnlineViaEBA,isWithoutISBN);

	// Holdings speichern
	// Im Feld Zusammenfassung
	let oldAbstractNote = item.getField(targetField);
	item.setField(targetField, holdingsFormatted + "\n============================\n\n" + oldAbstractNote);
}

//XML Parsen
Zotero.swisscoveryubbernlocations.processXML2 = async function (xml) {
	// Schalter setzen
	let isInUBBe = false;
    let isInUBBeOnline = false;
	let isinUBBeKurierbib = false;
	let isWithoutISBN = false;
	// Formatierung der Ergebnisse
	let date = new Date();
	let thisMonth = date.getMonth() + 1;
	let currentDate = date.getFullYear() + "-" + thisMonth + "-" + date.getDate() + " (" + date.getHours() + ":"  + date.getMinutes() + ":" + date.getSeconds() + ")";
	let holdingsFormatted = currentDate + " Bestand Swisscovery UB Bern\n=======================================";
	let xmlResponse = xml.responseXML;
	// Haben wir Ergebnisse in Swissbib BB?
	// Nein =>
	if (xmlResponse.querySelector("searchRetrieveResponse > numberOfRecords").textContent == "0") {
		holdingsFormatted += ("\n" + noResultsInSwissbibBBText);
	// Ja =>
	} else {
		let holdings = xmlResponse.querySelectorAll("datafield[tag='AVA']");
		for (const holding of holdings) {
			var holdingLibraryCode, 
				holdingLibrary, 
				holdingLibraryLocation,
				holdingFormatted,
				holdingItemPolicy,
				holdingHoldingsID, // subfield 8
				holdingBibRecordID; // subfield 0
				//
				holdingLibraryCode = holding.querySelector("subfield[code='b']").textContent;
				if (holding.querySelector("subfield[code='q']")) {
					holdingLibrary = holding.querySelector("subfield[code='q']").textContent;
				} else {
					if (holdingLibraryCode == "B405") {
						holdingLibrary = "Bern UB Online";
					} else if (holdingLibraryCode == "A145") {
						holdingLibrary = "Basel Online";
					} else {
						holdingLibrary = holdingLibraryCode;
					}
				}
				if (holding.querySelector("subfield[code='c']")) 
					holdingLibraryLocation = holding.querySelector("subfield[code='c']").textContent;
				if (holding.querySelector("subfield[code='0']")) 
					holdingBibRecordID = holding.querySelector("subfield[code='0']").textContent;
				if (holding.querySelector("subfield[code='8']")) 
					holdingHoldingsID = holding.querySelector("subfield[code='8']").textContent;
				//
				holdingItemPolicy = Zotero.swisscoveryubbernlocations.getItemPolicy (holdingBibRecordID, holdingHoldingsID)
				holdingItemPolicy.then((policy) => {
					// hier haben wir ein Problem mit dem Scoping der Variablen...
					// wie bekomme ich die Variable holdingFormatted nach aussen?
				holdingFormatted = "\n" + holdingLibrary;
				if (holdingLibraryLocation) holdingFormatted = holdingFormatted + ", " + holdingLibraryLocation;
				if (policy) holdingFormatted = holdingFormatted + ", " + policy
				// Aktuelles Holding zur Holdingliste hinzufügen
			    holdingsFormatted += holdingFormatted;
				});			
		}
		return "asdf";
	}
}

Zotero.swisscoveryubbernlocations.updateLocations = async function (item,holdings) {
	let oldAbstractNote = item.getField(targetField);
	item.setField(targetField, holdings + "\n============================\n\n" + oldAbstractNote);
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

Zotero.swisscoveryubbernlocations.LocationLookup = async function () {
	Zotero.swisscoveryubbernlocations.Initialize();
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
		if (!(item.getField('ISBN')) || !(isbns.some(Zotero.swisscoveryubbernlocations.isValidIsbn) == true)) {
			// Keine (oder keine gültige) ISBN vorhanden
			let isInUBBe = false;
			let isInUBBeOnline = false;
			let isInUBBeOnlineViaEBA = false;
			let isinUBBeKurierbib = false;
			let isWithoutISBN = true;
			Zotero.swisscoveryubbernlocations.ApplyTags(item,isInUBBe,isinUBBeKurierbib,isInUBBeOnline,isInUBBeOnlineViaEBA,isWithoutISBN);
			await item.saveTx();
		} else {
			// Mindestens eine gültige ISBN vorhanden
			// SRU-Request
			let URL = sruPrefix + isbns.join(" or alma.isbn=");
			let sru = new XMLHttpRequest();
			sru.onreadystatechange = async function() {
					if (this.readyState == 4 && this.status == 200) {
					await Zotero.swisscoveryubbernlocations.processXML(item,this)
					await item.saveTx();
			}; 
			};
			sru.open("GET", URL, true);
			sru.send();
		}
	};
};

Zotero.swisscoveryubbernlocations.orderNoteFromTags = async function () {
	// Zuerst holen wir die aktuell ausgewählten Titel
	var ZoteroPane = Zotero.getActiveZoteroPane();
	var selectedItems = ZoteroPane.getSelectedItems();
	// Alle nicht-Buch-Titel werden herausgefiltert
	var items = selectedItems.filter(item => item.itemTypeID == Zotero.ItemTypes.getID('book'));
	// Loop durch die Items
	for (const item of items) {
		tags = item.getTags();
		// initialize vars
		let ddcs = [];
		let orderCodes = [];
		let budgetCode = "";
		// iterate over tags
		for (let tag of tags) {
			if (tag.tag.startsWith("DDC")) {
				// tag is a DDC
				tagText = tag.tag.replace(/[^0-9X]/gi, '');
				ddcs.push(tagText)
			}
			else if (tag.tag.startsWith("BC")) {
				// tag is an orderCode
				orderCodeText =  tag.tag.substring(3);
				orderCodes.push(orderCodeText);
			}
			else if (tag.tag.startsWith("ETAT")) {
				// tag is an budgetCode
				budgetCode =  tag.tag.substring(5);
			}
		}
		// construct orderNote
		let orderNote = [];
		orderNote.push(budgetCode);
		orderNote.push(ddcs.join(', '));
		orderNote.push(orderCodes.join(', ')); // maybe better use a semicolon?
		orderNote = orderNote.filter(Boolean);
		orderNote = orderNote.join(' // ');
		// update volume field and save item
		item.setField('volume', orderNote);
		await item.saveTx();
	};
};
