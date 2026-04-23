var SUL;

function log(msg) {
	Zotero.debug("[ Swisscovery UB Bern Locations ] : " + msg);
}

async function install() {
	log("Installed version 0.2.12 of" + `'${id}'`);
}

async function startup({ id, version, rootURI }) {
	try {

		log("Starting plugin");
		log("id: " + `'${id}'`);
		log("version: " + `'${version}'`);
		log("rootURI: " + `'${rootURI}'`);
		//log("Saving to: " + Zotero.Prefs.get('extensions.SUL.targetField', true))

		// register preference pane
		Zotero.PreferencePanes.register({
			pluginID: 'zoteroswisscoveryubbernlocations@ubbe.org',
			src: rootURI + 'content/prefs.xhtml',
			//scripts: [rootURI + 'preferences.js'],
		});
		
		Services.scriptloader.loadSubScript(rootURI + 'swisscoveryubbernlocations.js');

		SUL.init({ id, version, rootURI });
		SUL.registerMenu();
		for (const win of Zotero.getMainWindows()) {
			if (win.ZoteroPane) SUL.ensureFTL(win);
		}
	} catch (error) {
		this.log("Error during startup");
		this.log(error);
	}
}

function onMainWindowLoad({ window }) {
	try {
		SUL.ensureFTL(window);
	} catch (error) {
		this.log("Error while loading main window");
		this.log(error);
	}
}

function shutdown() {
	try {
		log("Shutting down");
		SUL.unregisterMenu();
		SUL = undefined;
	} catch (error) {
		this.log("Error while shutting down");
		this.log(error);
	}
}

function uninstall() {
	try {
		log("Uninstalled");
	} catch (error) {
		this.log("Error while uninstalling");
		this.log(error);
	}
}