# Funimation Downloader NX

Funimation Downloader NX is capable of downloading video from the Funimation streaming service.

## Legal Warning

This application is not endorsed or affiliated with Funimation. The usage of this application enables video to be downloaded for offline convenience which may be forbidden by law in your country. Usage of this application may also cause a violation of the agreed *Terms of Service* between you and the stream provider. A tool is not responsible for your actions; please make an informed decision prior to using this application.

## Prerequisites

* NodeJS >= 7.8.0 (https://nodejs.org/)
* NPM >= 4.0.0 (https://www.npmjs.org/)
* Streamlink >= 0.5.0 (https://github.com/streamlink/streamlink)
* MKVToolNix >= 10.0.0 (https://github.com/mbunkus/mkvtoolnix)
* tsMuxeR >= 2.6.12 (https://www.videohelp.com/software/tsMuxeR)
* MP4Box >= 0.6.0 (https://github.com/gpac/gpac)

## Switches

### Authentication

* `--mail <s> --pass  <s>` sets the email and password.

### Get show id

* `--search <s>` set show title for search

### Download video

* `-s <i> --sel <i>` sets the show id and episode number
* `--cat <s>` episode category [episode/movie/ova] (optional, "episode" by default)
* `--sub` switch from english dub to japanese dub with subtitles
* `--proxy <s>` set ipv4 http(s) proxy for all requests to funimation api

### filenaming options (optional)

* `-t <s>` series title override
* `--ep <s>` episode number override
* `--suffix <s>` filename suffix override (first "SIZEp" will be raplaced with actual video size, "SIZEp" by default)