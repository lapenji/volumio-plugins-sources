var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
const http = require('https');

module.exports = streampunk;

function streampunk(context) {
	var self = this;

	self.context = context;
	self.commandRouter = this.context.coreCommand;
	self.logger = this.context.logger;
	self.configManager = this.context.configManager;

	self.state = {}
	self.timer = null;
}

streampunk.prototype.onVolumioStart = function () {
	var self = this;
	self.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json')
	self.getConf(self.configFile)
	return libQ.resolve();
}

streampunk.prototype.deleteSrc = function (data) {
	var self = this
	console.log('LOGGO RADIOSTATIONS PRIMA DEL DELETE')
	console.table(self.radioResource.stations.streampunk)
	self.radioStations.streampunk.splice(data.value -1, 1)
	for (let i = 0; i < self.radioStations.streampunk.length; i++) {
		self.radioStations.streampunk[i].uri = 'webstp/' + i
	}
	console.log('LOGGO RADIO STATIONS DOPO DELETE')
	console.table(self.radioResource.stations.streampunk)
	try {
		fs.writeJsonSync('/data/plugins/music_service/streampunk/radio_stations.json', self.radioResource)
	} catch (e) {
		console.log(e)
	}
	self.getRadioContent()
	var defer = libQ.defer()
	return defer.promise
}

streampunk.prototype.getConfigurationFiles = function () {
	return ['config.json'];
}

streampunk.prototype.onStart = function () {
	var self = this;
	self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

	self.loadRadioI18nStrings();

	self.addRadioResource();

	self.addToBrowseSources();

	self.serviceName = "streampunk";

	return libQ.resolve();
}

streampunk.prototype.onStop = function () {
	var self = this;

	self.removeFromBrowseSources();
	return libQ.resolve()
}

streampunk.prototype.onRestart = function () {
	var self = this;

	return libQ.resolve();
}

streampunk.prototype.getUIConfig = function () {
	var defer = libQ.defer();
	var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');
	
	self.getConf(this.configFile);
	console.log('----LUNGHEZZA DI STREAMPUNK---\n\n', this.radioStations.streampunk.length)
	self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json', __dirname + '/i18n/strings_en.json', __dirname + '/UIConfig.json')
		.then((uiconf) => {

			console.log("STAMPO")
			//uiconf.sections[0].content[0].value.value = this.radioStatoins.streampunk.length
			console.log('valore dopo')
			console.log(uiconf.sections[0].content[0].value.value)
			for (var i = 0; i < this.radioStations.streampunk.length; i++) {
				console.log('entro')
				console.log (this.radioStations.streampunk[i].title)
				uiconf.sections[0].content[0].options.push({value: i, label: this.radioStations.streampunk[i].title})
			}
			console.log('UICONF SECTIONS 0 CONTENT 0\n',uiconf.sections[0].content[0].options)
			

			defer.resolve(uiconf)
		})
		.fail(() => {
			defer.reject(new Error())
		})

	return defer.promise;
}

streampunk.prototype.setUiConfig = function (data) {
	var self = this;
	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

	return libQ.resolve()
}

streampunk.prototype.getConf = function (configFile) {
	var self = this;

	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);
}

streampunk.prototype.setConf = function (varName, varValue) {
	var self = this;
	fs.writeJsonSync(self.configFile, JSON.stringify(conf));
}

streampunk.prototype.updateConfig = function (data) {
	var self = this;
	console.log ('radio stations prima di aggiunta\n', self.radioResource)
	const currentMaxStation = this.radioStations.streampunk.length;
	const newStation = {
		title: data.name,
		uri: 'webstp/' + currentMaxStation,
		url: data.url,
		art: "/albumart?sourceicon=music_service/streampunk/streampunk.svg"
	}
	self.radioStations.streampunk.push(newStation)
	console.log ('radio stations dopo aggiunta\n', self.radioStations)
	try {
		fs.writeJsonSync('/data/plugins/music_service/streampunk/radio_stations.json', self.radioResource)
	} catch (e) {
		console.log(e)
	}
	self.getRadioContent()
	var defer = libQ.defer()
	return defer.promise
}


streampunk.prototype.addToBrowseSources = function () {
	var self = this;

	self.commandRouter.volumioAddToBrowseSources({
		name: self.getRadioI18nString('PLUGIN_NAME'),
		uri: 'streampunk',
		plugin_type: 'music_service',
		plugin_name: 'streampunk',
		albumart: '/albumart?sourceicon=music_service/streampunk/streampunk.svg'
	})
}

streampunk.prototype.removeFromBrowseSources = function () {
	var self = this;

	self.commandRouter.volumioRemoveToBrowseSources(self.getRadioI18nString('PLUGIN_NAME'))
}

streampunk.prototype.handleBrowseUri = function (currentUri) {
	var self = this;
	var response;
	if (currentUri.startsWith('streampunk')) {
		response = self.getRadioContent('streampunk');
	}
	return response
		.fail((e) => {
			self.logger.error('[' + Date.now() + '] ' + '[streampunk] handleBrowseUri failed');
			libQ.reject(new Error());
		})
}

streampunk.prototype.getRadioContent = function (station) {
	var self = this;
	var response;
	var radioStation;
	var defer = libQ.defer();

	radioStation = self.radioStations.streampunk;

	response = self.radioNavigation;
	response.navigation.lists[0].items = [];
	for (var i in radioStation) {
		var channel = {
			service: self.serviceName,
			type: 'mywebradio',
			title: radioStation[i].title,
			artist: '',
			album: '',
			icon: 'fa fa-music',
			uri: radioStation[i].uri
		}
		response.navigation.lists[0].items.push(channel);
	}
	defer.resolve(response)

	return defer.promise;

}

streampunk.prototype.clearAddPlayTrack = function (track) {
	var self = this;
	if (self.timer) {
		self.timer.clear();
	}
	return self.mpdPlugin.sendMpdCommand('stop', [])
		.then(() => {
			return self.mpdPlugin.sendMpdCommand('clear', []);
		})
		.then(() => {
			return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
		})
		.then(() => {
			self.commandRouter.pushToastMessage('info', self.getRadioI18nString('PLUGIN_NAME'), self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));
			return self.mpdPlugin.sendMpdCommand('play', []).then(() => {
				self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

				return libQ.resolve();
			})
		})
}

streampunk.prototype.stop = function () {
	var self = this;
	if (self.timer) {
		self.timer.clear();
	}
	self.commandRouter.pushToastMessage(
		'info',
		self.getRadioI18nString('PLUGIN_NAME'),
		self.getRadioI18nString('STOP_RADIO_CHANNEL')
	);

	return self.mpdPlugin.stop()
		.then(function () {
			self.state.status = 'stop';
			self.commandRouter.servicePushState(self.state, self.serviceName);
		});
};

streampunk.prototype.resume = function () {
	var self = this;

	return self.mpdPlugin.sendMpdCommand('play', []).then(() => {
		self.state.status = 'play';
		self.commandRouter.servicePushState(self.state, self.serviceName)
	})
}

streampunk.prototype.explodeUri = function (uri) {
	var self = this;
	var defer = libQ.defer();
	var response = [];

	var uris = uri.split('/');
	var channel = parseInt(uris[1])
	var query;
	var station;
	console.log('explode uri:\n')
	console.log('uris: ', uris);
	console.log('channel: ', channel)
	station = uris[0].substring(3);
	switch (uris[0]) {
		case 'webstp':
			if (self.timer) {
				self.timer.clear()
			}
			response.push({
				service: self.serviceName,
				type: 'track',
				trackType: self.getRadioI18nString('PLUGIN_NAME'),
				radioType: station,
				album: self.radioStations.streampunk[channel].title,
				albumart: self.radioStations.streampunk[channel].art,
				uri: self.radioStations.streampunk[channel].url,
				name: self.radioStations.streampunk[channel].title,
				duration: 10000
			})
			defer.resolve(response);
			break;
		default:
			defer.resolve();
	}
	return defer.promise;
}

streampunk.prototype.addRadioResource = function () {
	var self = this;

	var radioResource = fs.readJsonSync(__dirname + '/radio_stations.json')
	var baseNavigation = radioResource.baseNavigation;
	self.radioResource = radioResource

	self.radioStations = radioResource.stations;
	self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation))
	self.radioNavigation = JSON.parse(JSON.stringify(baseNavigation))

}


streampunk.prototype.loadRadioI18nStrings = function (key) {
	var self = this;
	self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
	self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
}

streampunk.prototype.getRadioI18nString = function (key) {
	var self = this;

	if (self.i18nStrings[key] !== undefined)
		return self.i18nStrings[key];
	else
		return self.i18nStringsDefaults[key];
};

streampunk.prototype.search = function (query) {
	return libQ.resolve();
}

streampunk.prototype.errorToast = function (station, msg) {
	var self = this;

	var errorMessage = self.getRadioI18nString(msg);
	errorMessage.replace('{0}', station.toUpperCase());
	self.commandRouter.pushToastMessage('error', self.getRadioI18nString('PLUGIN_NAME'), errorMessage);
}
