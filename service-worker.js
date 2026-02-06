chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "stackit-menu",
    title: "Stackit",
    // This array tells Chrome when to show your button
    contexts: ["page", "selection", "image"] 
  });
});

chrome.contextMenus.onClicked.addListener((info, tab)=>{
  if (info.menuItemId === "stackit-menu"){
    chrome.storage.local.set({
      selectionText: info.selectionText
    });
  }
  chrome.sidePanel.open({windowId: tab.windowId});
})

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-stackit-sidebar") {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
