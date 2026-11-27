/**
 * Arkadia求人応募フォーム用 Google Apps Script Webアプリ
 *
 * 役割：
 * 1) LIFFから受け取った応募内容をGoogleスプレッドシートへ追記
 * 2) 任意の顔写真をGoogle Driveへ保存し、保存先リンクをシートへ記録
 * 3) LINEの写真付きFlex Message送信後に送信済み状態を更新
 */

const CONFIG = {
  SPREADSHEET_ID: '1xQZ7iRbG5bT_onZ-IRDLR8cTvg_AYLWq6supT_0UvoM',
  SHEET_NAME: '応募者一覧',
  PHOTO_FOLDER_NAME: 'Arkadia求人応募_顔写真',
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,
  // 任意。設定する場合はLIFF側のBACKEND_SHARED_SECRETにも同じ値を設定する。
  SHARED_SECRET: ''
};

const HEADERS = [
  '応募ID', '受付日時', '希望勤務店舗', '姓', '名', '姓（かな）', '名（かな）',
  '生年月日', '年齢', '性別（ジェンダー）', 'ポーカーディーラーのご経験', 'ディーラー歴',
  '所属店舗', 'ディーラーネーム', '電話番号', '顔写真ファイル名', '顔写真URL',
  'アピールポイント', '第1希望', '第2希望', '第3希望', 'その他・備考', 'LINE表示名',
  'LINEユーザーID', 'LINE Flex送信', 'LINE画像表示', '処理状況', 'メモ'
];

function doGet(e) {
  const params = e?.parameter || {};
  if (params.action === 'photo_media') {
    const payload = getPhotoMedia(params.submissionId);
    return jsonpResponse(params.callback, payload);
  }
  return jsonResponse({ ok: true, service: 'Arkadia求人応募受付', sheet: CONFIG.SHEET_NAME });
}

function doPost(e) {
  try {
    const body = parseRequestBody(e);
    if (CONFIG.SHARED_SECRET && body.sharedSecret !== CONFIG.SHARED_SECRET) {
      throw new Error('認証に失敗しました。');
    }

    if (body.action === 'mark_line_sent') {
      return markLineSent(body);
    }
    return appendApplication(body);
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: error.message || '受付処理に失敗しました。' });
  }
}

function parseRequestBody(e) {
  const raw = e?.postData?.contents || '{}';
  return JSON.parse(raw);
}

function getSheet() {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`シート「${CONFIG.SHEET_NAME}」が見つかりません。`);
  return sheet;
}

function appendApplication(body) {
  const application = body.application || {};
  const submissionId = String(body.submissionId || '').trim();
  if (!submissionId) throw new Error('応募IDがありません。');
  if (!application.preferredStore) throw new Error('希望勤務店舗がありません。');

  const sheet = getSheet();
  ensureStatusHeaders(sheet);
  const existingRow = findRowBySubmissionId(sheet, submissionId);
  if (existingRow > 0) {
    return jsonResponse({ ok: true, duplicate: true, submissionId });
  }

  const photo = savePhoto(body.photo, submissionId);
  const lineProfile = body.lineProfile || {};
  const now = new Date();
  const slots = application.interviewSlots || [];

  const row = [
    submissionId,
    now,
    application.preferredStore || '',
    application.lastName || '',
    application.firstName || '',
    application.lastNameKana || '',
    application.firstNameKana || '',
    application.birthDate || '',
    application.age === '' || application.age == null ? '' : application.age,
    application.gender || '',
    application.dealerExperience || '',
    application.dealerHistory || '',
    application.previousStore || '',
    application.dealerName || '',
    application.phone || '',
    photo.fileName || application.photoFileName || '',
    photo.url || '',
    application.appeal || '',
    formatSlot(slots[0]),
    formatSlot(slots[1]),
    formatSlot(slots[2]),
    application.notes || '',
    lineProfile.displayName || '',
    lineProfile.userId || '',
    '送信待ち',
    '送信待ち',
    '受付済み',
    ''
  ];

  sheet.appendRow(row);
  return jsonResponse({ ok: true, duplicate: false, submissionId, photoUrl: photo.url || '' });
}

function markLineSent(body) {
  const submissionId = String(body.submissionId || '').trim();
  if (!submissionId) throw new Error('応募IDがありません。');

  const sheet = getSheet();
  ensureStatusHeaders(sheet);
  const rowNumber = findRowBySubmissionId(sheet, submissionId);
  if (rowNumber < 2) throw new Error('応募IDに一致する記録が見つかりません。');

  // Y列：LINE Flex、Z列：Flex内画像、AA列：処理状況
  const imageStatus = body.hasPhoto ? 'Flex内表示済み' : '対象なし';
  sheet.getRange(rowNumber, 25, 1, 3).setValues([['送信済み', imageStatus, '受付済み']]);
  return jsonResponse({ ok: true, submissionId, lineSent: true });
}

function findRowBySubmissionId(sheet, submissionId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const index = ids.findIndex((value) => String(value) === submissionId);
  return index === -1 ? 0 : index + 2;
}

function ensureStatusHeaders(sheet) {
  sheet.getRange(1, 25, 1, 4).setValues([['LINE Flex送信', 'LINE画像表示', '処理状況', 'メモ']]);
}

function formatSlot(slot) {
  if (!slot || !slot.date) return '';
  if (slot.display) return slot.display;
  if (slot.allDay) return `${slot.date} 終日可能`;
  return `${slot.date} ${slot.start || ''}-${slot.end || ''}`.trim();
}

function savePhoto(photo, submissionId) {
  if (!photo || !photo.base64) return { fileName: '', url: '' };

  const fileName = String(photo.fileName || `${submissionId}.jpg`).replace(/[\\/:*?"<>|]/g, '_');
  const mimeType = String(photo.mimeType || 'image/jpeg');
  const base64 = String(photo.base64);
  const sizeBytes = Math.ceil(base64.length * 3 / 4);
  if (!['image/jpeg', 'image/png'].includes(mimeType)) throw new Error('顔写真はJPEGまたはPNGの画像ファイルを選択してください。');
  if (sizeBytes > CONFIG.MAX_PHOTO_BYTES) throw new Error('顔写真は5MB以内で選択してください。');

  const folder = getPhotoFolder();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, `${submissionId}_${fileName}`);
  const file = folder.createFile(blob);
  // LINEのFlex画像コンポーネントから取得できるよう、リンクを知っているユーザーに閲覧を許可する。
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { fileName, url: file.getUrl() };
}

function getPhotoMedia(submissionId) {
  const id = String(submissionId || '').trim();
  if (!id) return { ok: false, error: '応募IDがありません。' };

  const sheet = getSheet();
  const rowNumber = findRowBySubmissionId(sheet, id);
  if (rowNumber < 2) return { ok: false, error: '応募IDに一致する記録が見つかりません。' };

  const storedUrl = String(sheet.getRange(rowNumber, 17).getValue() || '').trim();
  if (!storedUrl) return { ok: true, photo: null };

  const fileId = extractDriveFileId(storedUrl);
  if (!fileId) return { ok: false, error: '顔写真の保存先を確認できませんでした。' };

  const file = DriveApp.getFileById(fileId);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    ok: true,
    photo: {
      originalContentUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
      previewImageUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800`
    }
  };
}

function extractDriveFileId(url) {
  const value = String(url || '');
  const queryMatch = value.match(/[?&]id=([^&]+)/);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);
  const pathMatch = value.match(/\/d\/([^/]+)/);
  return pathMatch ? pathMatch[1] : '';
}

function getPhotoFolder() {
  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty('PHOTO_FOLDER_ID');
  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (error) {
      properties.deleteProperty('PHOTO_FOLDER_ID');
    }
  }

  const folders = DriveApp.getFoldersByName(CONFIG.PHOTO_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
  properties.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonpResponse(callback, payload) {
  const callbackName = String(callback || '');
  if (!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callbackName)) {
    return jsonResponse({ ok: false, error: 'コールバック名が不正です。' });
  }
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return ContentService
    .createTextOutput(`${callbackName}(${json});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
