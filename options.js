"use strict";

/**
 * @typedef {{startDisplayTime:number, completeDisplayTime:number,cancelDisplayTime:number,errorDisplayTime:number, notifyClickAction:number, disableWatching:boolean, iconStyle:string}} CommonSettings
 */

const ICON_STYLE_DEFAULT = "default";
const ICON_STYLE_SIMPLE = "simple";

/** @type {CommonSettings} */
let commonSettings = {};

document.addEventListener("DOMContentLoaded", initialize, false);

function initialize(evt) {
  browser.runtime.sendMessage({
    method: "loadSettings"
  }, (response) => {
    commonSettings = response.commonSettings;
    let startElm = document.getElementById("start");
    let completeElm = document.getElementById("complete");
    let cancelElm = document.getElementById("cancel");
    let errorElm = document.getElementById("error");
    let actionCloseElm = document.getElementById("actionClose");
    let actionShowElm = document.getElementById("actionShow");
    let checkDisableWatchingElm = document.getElementById("checkDisableWatching");
    let radioIconStyleDefaultElm = document.getElementById("iconDefault");
    let radioIconStyleSimpleElm = document.getElementById("iconSimple");

    startElm.value = commonSettings.startDisplayTime;
    completeElm.value = commonSettings.completeDisplayTime;
    cancelElm.value = commonSettings.cancelDisplayTime;
    errorElm.value = commonSettings.errorDisplayTime;
    if (commonSettings.notifyClickAction === 1) {
      actionCloseElm.checked = true;
    } else {
      actionShowElm.checked = true;
    }
    if (commonSettings.disableWatching) {
      checkDisableWatchingElm.checked = true;
    } else {
      checkDisableWatchingElm.checked = false;
    }
    if (commonSettings.iconStyle === ICON_STYLE_DEFAULT) {
      radioIconStyleDefaultElm.checked = true;
    } else {
      radioIconStyleSimpleElm.checked = true;
    }
    
    let saveElm = document.getElementById("save");
    saveElm.addEventListener("click", clickSaveButton, false);

    startElm.addEventListener("input", validateInput, false);
    completeElm.addEventListener("input", validateInput, false);
    cancelElm.addEventListener("input", validateInput, false);
    errorElm.addEventListener("input", validateInput, false);

    let mainFormElm = document.getElementById("mainForm");
    mainFormElm.style.visibility = "visible";
  });
}

function checkValidity(elm) {
  return !(elm.validity.badInput || elm.validity.rangeOverflow || elm.validity.rangeUnderflow);
}

function validateInput() {
  let saveElm = document.getElementById("save");
  let startElm = document.getElementById("start");
  let completeElm = document.getElementById("complete");
  let cancelElm = document.getElementById("cancel");
  let errorElm = document.getElementById("error");
  if (!checkValidity(startElm)) {
    saveElm.classList.add("disabled");
    return;
  }
  if (!checkValidity(completeElm)) {
    saveElm.classList.add("disabled");
    return;
  }
  if (!checkValidity(cancelElm)) {
    saveElm.classList.add("disabled");
    return;
  }
  if (!checkValidity(errorElm)) {
    saveElm.classList.add("disabled");
    return;
  }
  saveElm.classList.remove("disabled");
}


function clickSaveButton() {
  let startElm = document.getElementById("start");
  let completeElm = document.getElementById("complete");
  let cancelElm = document.getElementById("cancel");
  let errorElm = document.getElementById("error");
  let actionCloseElm = document.getElementById("actionClose");
  let checkDisableWatchingElm = document.getElementById("checkDisableWatching");
  let radioIconStyleDefaultElm = document.getElementById("iconDefault");

  commonSettings.startDisplayTime = parseInt(startElm.value);
  commonSettings.completeDisplayTime = parseInt(completeElm.value);
  commonSettings.cancelDisplayTime = parseInt(cancelElm.value);
  commonSettings.errorDisplayTime = parseInt(errorElm.value);
  if (actionCloseElm.checked) {
    commonSettings.notifyClickAction = 1;
  } else {
    commonSettings.notifyClickAction = 2;
  }
  if (checkDisableWatchingElm.checked) {
    commonSettings.disableWatching = true;
  } else {
    commonSettings.disableWatching = false;
  }
  if (radioIconStyleDefaultElm.checked) {
    commonSettings.iconStyle = ICON_STYLE_DEFAULT;
  } else {
    commonSettings.iconStyle = ICON_STYLE_SIMPLE;
  }

  let infoElm = document.getElementById("info");
  infoElm.removeAttribute("id");
  infoElm.classList.remove("label-slide");
  infoElm.textContent = "";
  infoElm.style.disabled = "true";
  browser.runtime.sendMessage({
    method: "saveSettings",
    commonSettings: commonSettings
  });
  let parent = infoElm.parentElement;
  parent.removeChild(infoElm);
  let newElm = document.createElement("label");
  newElm.id = "info";
  newElm.textContent = "settings saved";
  newElm.classList.add("label-slide");
  parent.appendChild(newElm);
}