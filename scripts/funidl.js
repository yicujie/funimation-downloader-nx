// package json
const packageJson = require('./package.json');

// program name
console.log('\n=== Funimation Downloader NX '+packageJson.version+' ===\n');
const api_host = 'https://prod-api-funimationnow.dadcdigital.com';

// modules build-in
const { chdir } = require('process');
const path = require('path');
const fs = require('fs');

// modules extra
const shlp = require('sei-helper');
const yargs = require('yargs');
let request = require('request');

// folders
const configDir  = path.join(__dirname,'/config/');
const configBase = path.join(__dirname,'/base/');
let bin, workDir = {};

// check folders
if(fs.existsSync(configBase)){
	bin             = require(path.join(configBase,'/config.bin.js'));
	workDir         = require(path.join(configBase,'/config.dir.js'));
}
else{
	bin             = require(path.join(configDir,'/config.bin.js'));
	workDir.content = path.join(__dirname,'/../videos/');
	workDir.trash   = path.join(__dirname,'/../videos/_trash/');
}

// auth check
let token = false;
const cfgFilename = configDir + '/funi_auth.json';
if(fs.existsSync(cfgFilename)){
	token = require(cfgFilename).token;
}

// cli
let argv = yargs
	.wrap(Math.min(100))
	.usage('Usage: $0 [options]')
	
	// login
	.describe('mail','Your email')
	.describe('pass','Your password')
	
	// params
	.describe('s','Set show id')
	.describe('alt','alternative episode listing (if available)')
	.boolean('alt')
	
	.describe('sub','Sub mode (Dub mode by default)')
	.boolean('sub')
	
	.describe('q','Video quality.')
	.choices('q', ['234p','270p','288p','360p','480p','540p','720p','1080p'])
	.default('q','720p')
	
	.describe('a','Release group')
	.default('a','Funimation')
	
	.describe('ss','Select season')
	.default('ss','1')
	.describe('cat','Select category [episode/movie/ova]')
	.default('cat','episode')
	.describe('sel','Select episode')
	
	.describe('t','Filename: series title override')
	.describe('ep','Filename: episode number override')
	.describe('suffix','Filename: filename suffix override (first "SIZEp" will be raplaced with actual video size).')
	.default('suffix','SIZEp')
	
	.describe('mkv','mux into mkv')
	.boolean('mkv')
	
	.describe('mws','add subs to mkv (if available)')
	.boolean('mws')
	
	// login
	.describe('mail','Your email')
	.describe('pass','Your password')
	
	// proxy
	.describe('proxy','Set ipv4 http(s) proxy')
	
	// help
	.describe('h','Show this help')
	.alias('h','help')
	.boolean('h')
	
	.argv;

// check page
if(!isNaN(parseInt(argv.p, 10)) && parseInt(argv.p, 10) > 0){
	argv.p = parseInt(argv.p, 10);
}
else{
	argv.p = 1;
}

// check proxy
if(argv.proxy){
	if(!shlp.validateIpAndPort(argv.proxy)){
		console.log('Error: not ipv4 proxy. Skipping...\n');
	}
	else{
		request = require('request').defaults({'proxy':'http://'+argv.proxy,'timeout':10000});
	}
}

// fn variables
let fnTitle = '',
	fnEpNum = '',
	fnSuffix = '',
	fnOutput = '',
	stDlPath = false;

// select mode
if(argv.mail && argv.pass){
	doAuth();
}
else if(argv.s && !isNaN(parseInt(argv.s,10)) && parseInt(argv.s,10) > 0 || argv.search){
	if(argv.search){
		searchAnime();
	}
	else{
		getShowData();
	}
}
else{
	console.log(yargs.help());
	process.exit();
}

// auth
function doAuth(){
	let options = {
		url: api_host+'/api/auth/login/',
		formData: {
			username: argv.mail,
			password: argv.pass
		}
	};
	request.post(options, (err, mes, body) => {
		if (err) return err;
		if (mes) {}
		if(body.match(/<html/)){
			console.log('Unknown error.\n');
		}
		else if(body){
			parseAuth(body);
		}
	});
}
function parseAuth(authData){
	authData = JSON.parse(authData);
	if(authData.token){
		console.log('Auth success, your token:',authData.token.slice(0,7)+'*'.repeat(33),'\n');
		fs.writeFileSync(cfgFilename,JSON.stringify({"token":authData.token},null,'\t'));
	}
	else{
		console.log('Error:',authData.error,'\n');
	}
}

function searchAnime(){
	let options = {
		url: api_host+'/api/source/funimation/search/auto/',
		qs: {
			unique: true,
			limit: 100,
			q: argv.search,
			offset: (argv.p-1)*1000
		}
	};
	if(token){
		options.headers = {
			Authorization: 'Token '+token
		};
	}
	request.get(options, (err, mes, body) => {
		if (err) return err;
		if (mes) {}
		if(body.match(/<html/)){
			console.log('Unknown error.\n');
		}
		else if(body){
			parseSearch(body);
		}
	});
}
function parseSearch(searchData){
	searchData = JSON.parse(searchData);
	if(searchData.items.hits){
		let shows = searchData.items.hits;
		for(let ssn in shows){
			console.log('[#'+shows[ssn].id+'] '+shows[ssn].title+' ('+shows[ssn].tx_date+')');
		}
	}
	console.log('Total titles found:',searchData.count,'\n');
}

// show data
function getShowData(){
	let options = {
		url: api_host+'/api/source/catalog/title/'+parseInt(argv.s,10)
	};
	if(token){
		options.headers = {
			Authorization: 'Token '+token
		};
	}
	request.get(options, (err, mes, body) => {
		if (err) return err;
		if (mes) {}
		if(body.match(/<!doctype html>/)){
			console.log('Title not avaible in your region(?).\n');
		}
		else if(body.match(/<html/)){
			console.log('Unknown error.\n');
		}
		else if(body){
			parseShowData(body);
		}
	});
}
function parseShowData(showData){
	let s = JSON.parse(showData);
	if(s.items && s.items.length>0){
		getEpsData();
	}
	else if(s.status){
		console.log('Error ('+s.status+'):',s.data.errors[0].detail,'\n');
	}
	else{
		console.log('Unknown error.\n');
	}
}

// episodes list
function getEpsData(){
	let options = {
		url: api_host+'/api/funimation/episodes/',
		qs: {
			limit: -1,
			sort: 'order',
			sort_direction: 'ASC',
			title_id: parseInt(argv.s,10)
		}
	};
	if(argv.alt){
		options.qs.language = 'English';
	}
	if(token){
		options.headers = {
			Authorization: 'Token '+token
		};
	}
	request.get(options, (err, mes, body) => {
		if (err) return err;
		if (mes) {}
		if(body.match(/<!doctype html>/)){
			console.log('Title not avaible in your region(?).\n');
		}
		else if(body.match(/<html/)){
			console.log('Unknown error.\n');
		}
		else if(body){
			parseEpsData(body);
		}
	});
}
function parseEpsData(epsData){
	let eps = JSON.parse(epsData).items;
	let episode_data = [];
	let selected = false, selected_data = {};
	for(let e in eps){
		if(eps[e].item.seasonNum == argv.ss && eps[e].item.episodeNum == argv.sel && eps[e].mediaCategory == argv.cat){
			selected = true;
			selected_data = {title:eps[e].item.titleSlug,episode:eps[e].item.episodeSlug};
			eps[e].item.selected = true;
		}
		else{
			eps[e].item.selected = false;
		}
		// console vars
		let ss_snum = eps[e].item.seasonNum > 9 ? eps[e].item.seasonNum : '0'+eps[e].item.seasonNum;
		let ss_enum = eps[e].item.episodeNum > 9 ? eps[e].item.episodeNum : '0'+eps[e].item.episodeNum;
		let ss_type = eps[e].mediaCategory;
		let tx_snum = eps[e].item.seasonNum==1?'':' S'+eps[e].item.seasonNum;
		let qua_str = eps[e].quality.height ? eps[e].quality.quality +''+ eps[e].quality.height : 'UNK';
		let aud_str = eps[e].audio.length > 0 ? ', '+eps[e].audio.join(', ') : '';
		let rtm_str = eps[e].item.runtime !== '' ? eps[e].item.runtime : '??:??';
		// console string
		let conOut  = '[s'+ss_snum+'e'+ ss_enum+ ' '+ss_type+'] ';
			conOut += eps[e].item.titleName + tx_snum + ' - #'+ eps[e].item.episodeNum+ ' ' +eps[e].item.episodeName+ ' ';
			conOut += '('+rtm_str+') ['+qua_str+aud_str+ ']';
		console.log(conOut);
	}
	if(selected){
		getEpisodeData(selected_data);
	}
	else{
		console.log();
	}
}

// get episode data
function getEpisodeData(fnSlug){
	let options = {
		url: api_host+'/api/source/catalog/episode/'+fnSlug.title+'/'+fnSlug.episode+'/',
	};
	if(token){
		options.headers = {
			Authorization: 'Token '+token
		};
	}
	request.get(options, (err, mes, body) => {
		if (err) return err;
		if (mes) {}
		if(body.match(/<html/)){
			console.log('\nUnknown error.\n');
		}
		else if(body){
			parseEpisodeData(body);
		}
	});
}
function parseEpisodeData(epData){
	let ep = JSON.parse(epData).items[0];
	let sID = 0;
	// build fn
	fnTitle = argv.t ? argv.t : ep.parent.title;
	ep.number = isNaN(ep.number) ? ep.number : ( parseInt(ep.number, 10) < 10 ? '0' + ep.number : ep.number );
	if(ep.mediaCategory != 'Episode'){
		ep.number = ep.mediaCategory+ep.number;
	}
	fnEpNum = argv.ep ? ( parseInt(argv.ep, 10) < 10 ? '0' + argv.ep : argv.ep ).replace('_','') : ep.number;
	fnSuffix = argv.suffix.replace('SIZEp',argv.q);
	fnOutput = shlp.cleanupFilename('['+argv.a+'] ' + fnTitle + ' - ' + fnEpNum + ' ['+ fnSuffix +']');
	console.log('Output filename: '+fnOutput,'\n\nAvailable audio tracks:');
	// end fn
	for(let m in ep.media){
		if(ep.media[m].mediaType=='experience'){
			let media_id = ep.media[m].id;
			let dub_type = ep.media[m].title.split('_')[1];
			let selected = false;
			if(dub_type == 'Japanese' && argv.sub){
				sID = ep.media[m].id;
				selected = true;
				stDlPath = getSubsUrl(ep.media[m].mediaChildren);
			}
			else if(dub_type == 'English' && !argv.sub){
				sID = ep.media[m].id;
				selected = true;
				stDlPath = getSubsUrl(ep.media[m].mediaChildren);
			}
			console.log('[#'+media_id+'] '+dub_type+(selected?' (selected)':''));
		}
	}
	if(sID>0){
		getStream(sID);
	}
	else{
		console.log('\nError: Japanese dub not found.\n');
	}
}

// subs url
function getSubsUrl(m){
	for(let i in m){
		let fpp = m[i].filePath.split('.');
		let fpe = fpp[fpp.length-1];
		if(fpe == 'vtt'){
			return m[i].filePath;
		}
	}
	return false;
}

// get stream data
function getStream(sID){
	let options = {
		url: api_host+'/api/source/catalog/video/'+sID+'/signed'
	};
	if(token){
		options.headers = {
			Authorization: 'Token '+token
		};
	}
	request.get(options, (err, mes, body) => {
		if (err) return err;
		if (mes) {}
		if(body.match(/<html/)){
			console.log('Unknown error.\n');
		}
		else if(body){
			parseStream(body);
		}
	});
}

function parseStream(streamData){
	let s = JSON.parse(streamData), url = false;
	if(s.errors){
		console.log('\nError ('+s.errors[0].code+'):',s.errors[0].detail,'\n');
	}
	else{
		for(let u in s.items){
			if(s.items[u].videoType == 'm3u8'){
				url = s.items[u].src;
				break;
			}
		}
		if(url){
			downloadStream(url);
		}
		else{
			console.log('\nError: Unknown error\n');
		}
	}
}

function downloadStream(url){
	// to work dir
	chdir(workDir.content);
	// download video
	shlp.exec(
		'streamlink',
		'"'+path.normalize(bin.streamlink)+'"',
		'"hlsvariant://'+url+'" '+argv.q+' --hls-segment-attempts 10 --hls-segment-threads 10 --hls-segment-timeout 60 -o "'+fnOutput+'.ts"',
		true
	);
	// display sub url (in progress)
	console.log();
	if(stDlPath){
		console.log('Subtitles url:',stDlPath,'\n');
	}
	console.log();
	// select muxer
	if(!argv.mkv){
		// demux streams
		let ts2meta  = 'MUXOPT --no-pcr-on-video-pid --new-audio-pes --demux --vbr  --vbv-len=500\n';
			ts2meta += 'V_MPEG4/ISO/AVC, "'+workDir.content+'/'+fnOutput+'.ts", insertSEI, contSPS, track=256\n';
			ts2meta += 'A_AAC, "'+workDir.content+'/'+fnOutput+'.ts", track=257';
		fs.writeFileSync(fnOutput+'.meta',ts2meta);
		shlp.exec(
			'tsmuxer',
			'"'+path.normalize(bin.tsmuxer)+'"',
			'"'+fnOutput+'.meta" "'+workDir.content+'"',
			true
		);
		fs.renameSync(fnOutput+'.track_256.264',fnOutput+'.264');
		fs.renameSync(fnOutput+'.track_257.aac',fnOutput+'.aac');
		// mux to mp4
		let mp4arg  = ' -add "'+fnOutput+'.264#video:name=['+argv.a+']"';
			mp4arg += ' -add "'+fnOutput+'.aac#audio:lang='+(argv.sub?'jpn':'eng')+':name="';
			mp4arg += ' -new "'+fnOutput+'.mp4"';
		shlp.exec(
			'mp4box',
			'"'+path.normalize(bin.mp4box)+'"',
			mp4arg,
			true
		);
		// cleanup
		fs.unlinkSync(fnOutput+'.meta');
		fs.renameSync(fnOutput+'.264', workDir.trash+'/'+fnOutput+'.264');
		fs.renameSync(fnOutput+'.aac', workDir.trash+'/'+fnOutput+'.aac');
	}
	else{
		// mux to mkv (in progress)
	}
}


