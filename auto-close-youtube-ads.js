// ==UserScript==
// @name         Auto Close YouTube Ads
// @namespace    https://github.com/Ssawa
// @version      1.2.2
// @description  Close and/or Mute YouTube ads automatically!
// @author       Original: fuzetsu, Forked by: CJ DiMaggio
// @match        https://*.youtube.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @require      https://greasyfork.org/scripts/5679-wait-for-elements/code/Wait%20For%20Elements.js?version=141779
// ==/UserScript==

// A fork from https://greasyfork.org/scripts/9165-auto-close-youtube-ads/code/Auto%20Close%20YouTube%20Ads.user.js to allow for autopause

var Util = {
  log: function () {
    var args = [].slice.call(arguments);
    args.unshift('%c' + SCRIPT_NAME + ':', 'font-weight: bold;color: purple;');
    console.log.apply(console, args);
  },
  clearTicks: function(ticks) {
    ticks.forEach(function(tick) {
      if(typeof tick === 'number') {
        clearInterval(tick);
      } else {
        tick.stop();
      }
    });
    ticks.length = 0;
  },
  keepTrying: function(wait, action) {
    var tick = setInterval(function() {
      if(action()) {
        clearInterval(tick);
      }
    }, wait);
  },
  storeGet: function(key) {
    if (typeof GM_getValue === "undefined") {
      var value = localStorage.getItem(key);
      if (value === "true" || value === "false") {
        return (value === "true") ? true : false;
      }
      return value;
    }
    return GM_getValue(key);
  },
  storeSet: function(key, value) {
    if (typeof GM_setValue === "undefined") {
      return localStorage.setItem(key, value);
    }
    return GM_setValue(key, value);
  },
  storeDel: function(key) {
    if (typeof GM_deleteValue === "undefined") {
      return localStorage.removeItem(key);
    }
    return GM_deleteValue(key);
  },
  q: function(query, context) {
    return (context || document).querySelector(query);
  },
  qq: function(query, context) {
    return [].slice.call((context || document).querySelectorAll(query));
  },
};

var SCRIPT_NAME = 'Auto Close YouTube Ads';
var SEC_WAIT = parseInt(Util.storeGet('SEC_WAIT'));
var MUTE_AD = Util.storeGet('MUTE_AD');
var HIDE_AD = Util.storeGet('HIDE_AD');
var AUTO_PAUSE = Util.storeGet('AUTO_PAUSE');
var MUTE_BUTTON_SELECTOR = '.ytp-mute-button';
var MUTE_INDICATOR_SELECTOR = '.ytp-volume-slider-handle';
var PLAY_BUTTON_SELECTOR = '.ytp-play-button';
var ticks = [];
var videoUrl;

if(!MUTE_AD && MUTE_AD !== false) MUTE_AD = true;
if(!SEC_WAIT && SEC_WAIT !== 0) SEC_WAIT = 3;

function waitForAds() {
  ticks.push(
    waitAndClick('.videoAdUiSkipButton', function(btn) {
      Util.keepTrying(1000, function() {
        btn.click();
        if(!Util.q('.videoAdUiSkipButton')) {
          return true;
        }
      });
    }),
    waitAndClick('a.close-button', function(btn) {
      Util.q('div.recall-button').remove();
    })
  );
  if(MUTE_AD) {
    ticks.push(waitForElems('.videoAdUi', function(ad) {
      if(HIDE_AD) {
        ad.style.zIndex = 10;
        ad.style.background = 'black';
      }
      var muteButton = Util.q(MUTE_BUTTON_SELECTOR);
      var muteIndicator = Util.q(MUTE_INDICATOR_SELECTOR);
      if(!muteIndicator) return Util.log('unable to determine mute state, skipping mute');
      if( muteIndicator.style.left === '0px') {
        Util.log('Video ad detected, audio already muted so respecting user setting');
        return;
      }
      // mute the ad
      muteButton.click();
      Util.log('Video ad detected, muting audio');
      // wait for the ad to dissapear before unmuting
      Util.keepTrying(500, function() {
        if(!Util.q('.videoAdUi')) {
          if(muteIndicator.style.left === '0px') {
            muteButton.click();
            Util.log('Video ad ended, unmuting audio');
          } else {
            Util.log('Video ad ended, audio already unmuted');
          }
          return true;
        }
      });

      if(AUTO_PAUSE) {
          Util.log('Registering auto pause');
          var playButton = Util.q(PLAY_BUTTON_SELECTOR);
          Util.keepTrying(500, function() {
              if(!Util.q('.videoAdUi')) {
                  if(playButton.getAttribute('aria-label').toLowerCase() == 'pause') {
                      playButton.click();
                      Util.log('Video ad ended, pausing video');
                  } else {
                      Util.log('Video ad ended, already paused');
                  }
                  return true;
              }
          });
      }
    }));
  }
}

function waitAndClick(sel, cb, extraWait) {
  return waitForElems(sel, function(btn) {
    Util.log('Found ad, closing in', SEC_WAIT, 'seconds');
    setTimeout(function() {
      btn.click();
      if(cb) {
        cb(btn);
      }
    }, SEC_WAIT * 1000 + (extraWait || 0));
  });
}

Util.log('Started');

if(window.self === window.top) {
  waitForUrl(/^https:\/\/www\.youtube\.com\/watch\?.*v=.+/, function() {
    if(videoUrl && location.href !== videoUrl) {
      Util.log('Changed video, removing old wait');
      Util.clearTicks(ticks);
    }
    videoUrl = location.href;
    Util.log('Entered video, waiting for ads');
    waitForAds();
    ticks.push(
      waitForUrl(function(url) {
        return url !== videoUrl;
      }, function() {
        videoUrl = null;
        Util.clearTicks(ticks);
        Util.log('Left video, stopped waiting for ads');
      }, true)
    );
  });
} else {
  if(/https:\/\/www\.youtube\.com\/embed\//.test(location.href)) {
    Util.log('Found embedded video, waiting for ads');
    waitForAds();
  }
}

// register menu commands
GM_registerMenuCommand(SCRIPT_NAME + ': set ad close delay', function() {
  var wait = parseInt(prompt('Current setting is ' + SEC_WAIT + ' seconds. Enter the number of seconds you would like the script to wait before closing an ad. 0 means no delay.'));
  if(!isNaN(wait)) {
    SEC_WAIT = wait;
    Util.storeSet('SEC_WAIT', SEC_WAIT);
  }
});
GM_registerMenuCommand(SCRIPT_NAME + ': ' + (MUTE_AD ? 'disable' : 'enable') + ' video ad muting (warning clicking this will refresh the page)', function() {
  Util.storeSet('MUTE_AD', !MUTE_AD);
  location.reload();
});
GM_registerMenuCommand(SCRIPT_NAME + ': ' + (HIDE_AD ? 'disable' : 'enable') + ' video ad hiding (warning clicking this will refresh the page)', function() {
  Util.storeSet('HIDE_AD', !HIDE_AD);
  location.reload();
});
GM_registerMenuCommand(SCRIPT_NAME + ': ' + (AUTO_PAUSE ? 'disable' : 'enable') + ' automatically pausing the video after closing the ad.', function() {
  Util.storeSet('AUTO_PAUSE', !AUTO_PAUSE);
  location.reload();
});
