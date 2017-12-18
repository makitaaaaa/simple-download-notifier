"use strict";

/**
 * @typedef {{startDisplayTime:number, completeDisplayTime:number,cancelDisplayTime:number,errorDisplayTime:number, notifyClickAction:number, disableWatching:boolean, iconStyle:string}} CommonSettings
 */

/** @type {CommonSettings} */
let commonSettings = {};

let notificationDonwloadIdMap = {};
let isDebug = false;
let downloadsCreatedDelay = 250;
let downloadsUpdatedDelay = 350;

const NOTIFICATION_ID_PREFIX = "sdn-id"
const HOST_EMOJI_CODE = 0x1F4E1;
const ERROR_EMOJI_CODE = 0x1F4A3;
const SIZE_LABEL = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB"];

const STATE_IN_PROGRESS = "in_progress";
const STATE_COMPLETE = "complete";
const STATE_INTERRUPTED = "interrupted";

const ERROR_CODE_USER_CANCEL = "USER_CANCELED";

const ICON_STYLE_DEFAULT = "default";

//////////////////////////
// 初期化
//////////////////////////
loadSettings();
browser.runtime.onMessage.addListener(handleMessage);
browser.downloads.onCreated.addListener(handleDownloadCreated);
browser.downloads.onChanged.addListener(handleDonwloadChanged);
browser.notifications.onClicked.addListener(handleNotificationClick);
browser.runtime.onInstalled.addListener((details) => {
  if (details.temporary) {
    isDebug = true;
    log("* debug mode");
  }
});

//////////////////////////

/**
 * ログを出力する
 */
function log() {
  console.log.apply(this, arguments);
}

/**
 * ホスト名を取得する
 * @param {string} url URL
 */
function getHostname(url) {
  let hostname;
  if (url.indexOf("://") > -1) {
    hostname = url.split("/")[2];
  } else {
    hostname = url.split("/")[0];
  }
  hostname = hostname.split(":")[0];
  hostname = hostname.split("?")[0];
  return hostname;
}


/**
 * パスからファイル名を取得する
 * @param {string} path パス(nativeのローカルファイルパス)
 */
function getFilename(path) {
  let replacePath = path.replace(/\\/g, "/");
  let filename = replacePath.substring(replacePath.lastIndexOf("/") + 1);
  return filename;
}


/**
 * エラー処理
 * @param {Error} error 
 */
function handleError(error) {
  log(`Error: ${error}`);
}

/**
 * ダウンロード項目が作成された時のハンドル処理をする
 * @param {DownloadItem} item ダウンロード項目
 */
function handleDownloadCreated(item) {
  // 手動でdeltaを作成する
  let delta = {
    state: {
      current: STATE_IN_PROGRESS
    },
    id: item.id,
    isGenerate: true
  };
  setTimeout(() => {
    onDonwloadItemUpdated(delta);
  }, downloadsCreatedDelay);

  if (isDebug) {
    if (browser.runtime.lastError) {
      log("*** last error")
      log(browser.runtime.lastError);
    }
  }
}



/**
 * ダウンロード項目が更新された時のハンドル処理をする
 * @param {DownloadDelta} delta ダウンロード差分情報
 */
function handleDonwloadChanged(delta) {
  setTimeout(() => {
    onDonwloadItemUpdated(delta);
  }, downloadsUpdatedDelay);
}

/**
 * ダウンロード項目の更新時の処理をする(作成、更新含む)
 * @param {DownloadDelta} delta ダウンロード差分情報
 */
function onDonwloadItemUpdated(delta) {
  browser.downloads.search({
    id: delta.id,
    limit: 1,
  }, (downloads) => {
    if (downloads.length !== 1) {
      if (isDebug) {
        log("* download item not found");
        log(delta);
      }
      return;
    }
    let downloadItem = downloads[0];
    if (!commonSettings.disableWatching) {
      // 通常処理
      notifyDownloadItem(delta, downloadItem);
    } else {
      // 音楽再生タブがカレントの場合は通知を表示しない
      let querying = browser.tabs.query({
        currentWindow: true,
        active: true,
        audible: false
      });
      querying.then((tabs) => {
        if (isDebug) {
          log(" * tabs")
          log(tabs);
        }
        if (tabs.length > 0) {
          notifyDownloadItem(delta, downloadItem);
        }
      }, handleError);
    }
  });
}


/**
 * 通知処理をする
 * @param {object} delta 状態変化差分
 * @param {DownloadItem} downloadItem ダウンロード項目
 */
function notifyDownloadItem(delta, downloadItem) {
  let currentState = null;
  let currentError = null;
  // deltaから取れる場合はdeltaから取る
  if (delta.state && delta.state.current) {
    currentState = delta.state.current;
  }
  if (delta.error && delta.error.current) {
    currentError = delta.error.current;
  }
  if (currentState === null && currentError === null && delta.exists) {
    // existsだけ変動した場合は通知しない(ダウンロード後にダウンロードのプルダウンを開いた場合に発火する場合がある)
    return;
  }

  // deltaに格納されていない場合があるのでitemから取る
  if (currentState === null && downloadItem.state) {
    currentState = downloadItem.state;
  }
  if (currentError === null && downloadItem.error) {
    currentState = downloadItem.error;
  }
  if (isDebug) {
    log("* delta, download item")
    log(delta);
    log(downloadItem);
  }

  let url = downloadItem.url;
  let hostname = getHostname(url);
  let filename = getFilename(downloadItem.filename);
  let fileEmoji = getFileTypeEmojiCode(filename);
  let notificationId = `${NOTIFICATION_ID_PREFIX}-${downloadItem.id}-${getGuid()}`;
  let title = null;
  let iconUrl = null;
  let extMessage = null;
  let displayTime = null;
  let iconStyle = commonSettings.iconStyle;
  if (currentState === STATE_INTERRUPTED && currentError === ERROR_CODE_USER_CANCEL) {
    title = "download cancel";
    iconUrl = `icons/${iconStyle}/down-cancel.svg`;
    displayTime = commonSettings.cancelDisplayTime;
  }
  else if (currentError !== null) {
    title = "download error";
    iconUrl = `icons/${iconStyle}/down-err.svg`;
    extMessage = currentError;
    if (!((/^USER_.+$/).test(currentError))) {
      // USER由来の操作はエラーにしない
      displayTime = commonSettings.errorDisplayTime;
    }
  } else if (currentState === STATE_IN_PROGRESS) {
    title = "download start";
    iconUrl = `icons/${iconStyle}/down-start.svg`;
    displayTime = commonSettings.startDisplayTime;
  } else if (currentState === STATE_COMPLETE) {
    title = "download complete";
    iconUrl = `icons/${iconStyle}/down-comp.svg`;
    displayTime = commonSettings.completeDisplayTime;
  }
  if (displayTime === null) {
    return;
  }
  if (iconUrl === null) {
    return;
  }
  // メッセージ作成
  let size = -1;
  if (downloadItem.fileSize !== undefined && downloadItem.fileSize >= 0) {
    size = downloadItem.fileSize;
  } else if (downloadItem.totalBytes !== undefined && downloadItem.totalBytes >= 0) {
    size = downloadItem.totalBytes;
  }
  let sizeLabel = getFileSizeLabel(size);
  let message = `${String.fromCodePoint(HOST_EMOJI_CODE)}:${hostname}${"\n"}` +
    `${String.fromCodePoint(fileEmoji)}:${filename}`;
  if (size >= 0) {
    message += ` (${sizeLabel})`;
  }
  if (extMessage !== null) {
    message += `${"\n"}${String.fromCodePoint(ERROR_EMOJI_CODE)}:${extMessage}`;
  }
  // 表示＆消去
  let notifyOption = {
    type: "basic",
    iconUrl: browser.extension.getURL(iconUrl),
    title: title,
    message: message,
  };
  showNotifications(notificationId, notifyOption, downloadItem, displayTime);
}

/**
 * 通知を表示する
 * @param {number} notificationId 通知ID
 * @param {object} notifyOption 通知オプション
 * @param {DownloadItem} item ダウンロード項目
 * @param {number} displayTime 表示時間
 */
function showNotifications(notificationId, notifyOption, item, displayTime) {
  notificationDonwloadIdMap[notificationId] = item.id;
  if (isDebug) {
    log("* create notifications");
  }
  let notifying = browser.notifications.create(notificationId, notifyOption);
  notifying.then((id) => {
    setTimeout(() => {
      let clearing = browser.notifications.clear(id);
      clearing.then((wasCleared) => {
        setTimeout(() => {
          delete notificationDonwloadIdMap[notificationId];
        }, 1000);
      });
    }, displayTime);
  }, handleError);
}

/**
 * ファイル名の絵文字を取得する
 * @param {string} filename ファイル名
 */
function getFileTypeEmojiCode(filename) {
  let emojiCode = 0x1F4C4;
  if (filename.match(/\.(zip|rar|7z|z[0-9]{2}|lzh|z|tar|gz|cab|bz2|z|sit)$/i) !== null) {
    emojiCode = 0x1F5DC;
  } else if (filename.match(/\.(avi|wmv|mp4|mkv|mpg|mpeg|mov|ra|webm|flv|vod|ogv)$/i) !== null) {
    emojiCode = 0x1F39E;
  } else if (filename.match(/\.(exe|scr)$/i) !== null) {
    emojiCode = 0x1F5A5;
  } else if (filename.match(/\.(mp3|ogg|ape|mid|aac|flac|tta|wav|wma)$/i) !== null) {
    emojiCode = 0x1F3B5;
  } else if (filename.match(/\.(iso|mdf|mds|cue|ccd|cdi|img)$/i) !== null) {
    emojiCode = 0x1F4BF;
  } else if (filename.match(/\.(txt|doc|xls|docx|xlsx|odt|pdf|rtf|log|md|html|htm|xml)$/i) !== null) {
    emojiCode = 0x1F4C4;
  } else if (filename.match(/\.(bmp|jpg|gif|png|webp|pic|mng|psd|tga|tiff|tif|svg)$/i) !== null) {
    emojiCode = 0x1F5BC;
  }
  return emojiCode;
}

/**
 * ファイルサイズのラベルを取得する
 * @param {number} size ファイルサイズ
 */
function getFileSizeLabel(size) {
  if (size === null || size === undefined || size < 0) {
    return null;
  }
  let i = 0;
  let div = 1024.0;
  while (size >= div) {
    size = size / div;
    i++;
  }

  // 1000を超える表示を次の単位にする
  if (size >= 1000) {
    size = size / div;
    i++;
  }
  if (i == 0) {
    // バイトの場合
    return `${size} ${SIZE_LABEL[i]}`;
  }
  return `${(Math.floor(size * 10) / 10)} ${SIZE_LABEL[i]}`;
}

/**
 * 設定をロードする
 */
function loadSettings() {
  browser.storage.local.get("commonSettings", (item) => {
    if (item.commonSettings) {
      commonSettings = item.commonSettings;
    }

    if (commonSettings.startDisplayTime === undefined) {
      commonSettings.startDisplayTime = 5000;
    }
    if (commonSettings.completeDisplayTime === undefined) {
      commonSettings.completeDisplayTime = 5000;
    }
    if (commonSettings.cancelDisplayTime === undefined) {
      commonSettings.cancelDisplayTime = 5000;
    }
    if (commonSettings.errorDisplayTime === undefined) {
      commonSettings.errorDisplayTime = 10000;
    }
    if (commonSettings.notifyClickAction === undefined) {
      commonSettings.notifyClickAction = 1;
    }
    if (commonSettings.disableWatching === undefined) {
      commonSettings.disableWatching = false;
    }
    if (commonSettings.iconStyle === undefined) {
      commonSettings.iconStyle = ICON_STYLE_DEFAULT;
    }
  });
}

/**
 * 設定を保存する
 */
function saveSettings() {
  browser.storage.local.set({
    "commonSettings": commonSettings
  });
}

/**
 * メッセージを処理する
 * @param {Object} request リクエストメッセージ
 * @param {MessageSender} sender 送信者
 * @param {function} sendResponse 送信者へのコールバック関数
 */
function handleMessage(request, sender, sendResponse) {
  switch (request.method) {
    case "loadSettings":
      loadSettings();
      sendResponse({
        result: true,
        "commonSettings": commonSettings,
      });
      return true;
    case "saveSettings":
      commonSettings = request.commonSettings;
      saveSettings();
      return false;
  }
}

/**
 * 通知のクリック処理をする
 * @param {number} notificationId 通知ID
 */
function handleNotificationClick(notificationId) {
  if (commonSettings.notifyClickAction === 1) {
    return;
  }

  if (!(notificationId in notificationDonwloadIdMap)) {
    // download idが見つからない
    return;
  }
  let downloadId = notificationDonwloadIdMap[notificationId];
  delete notificationDonwloadIdMap[notificationId];
  let searching = browser.downloads.search({
    id: downloadId,
    exists: true,
    state: STATE_COMPLETE,
    limit: 1,
  });
  searching.then((downloads) => {
    if (downloads.length !== 1) {
      browser.downloads.showDefaultFolder();
      return;
    }
    let downloadItem = downloads[0];
    if (isDebug) {
      log("* notify click");
      log(downloadItem);
    }
    let showing = browser.downloads.show(downloadId);
    showing.then(() => {
      if (isDebug) {
        log("browser.downloads.show success");
      }
    }, (e) => {
      log("browser.downloads.show error");
      log(e);
    });
  }, handleError);
}

/**
 * GUIDを取得する
 * @return {string} GUID
 */
function getGuid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

/**
 * Sleepする
 * @param {number} ms MS
 */
function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}