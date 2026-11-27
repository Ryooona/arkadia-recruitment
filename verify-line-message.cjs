const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const source = [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)].at(-1)[1];

function createNode(id) {
  return {
    id,
    hidden: false,
    disabled: false,
    required: false,
    checked: false,
    value: '',
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    reportValidity() {},
    focus() {},
    select() {},
    setSelectionRange() {}
  };
}

const nodes = new Map();
const getNode = (id) => {
  if (!nodes.has(id)) nodes.set(id, createNode(id));
  return nodes.get(id);
};

const context = vm.createContext({
  URLSearchParams,
  console,
  setTimeout,
  clearTimeout,
  navigator: { userAgent: 'node' },
  window: {
    scrollTo() {},
    addEventListener() {},
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    history: { back() {} }
  },
  location: { search: '?preview=1' },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  document: {
    getElementById: getNode,
    querySelector: () => ({ value: '男性' }),
    querySelectorAll: () => [],
    addEventListener() {},
  }
});

vm.runInContext(source, context);

assert.equal(vm.runInContext("formatDateJa('2026-12-03')", context), '12月03日（木）');

const application = {
  lastName: '山田',
  firstName: '太郎',
  lastNameKana: 'やまだ',
  firstNameKana: 'たろう',
  birthDate: '2000-04-22',
  gender: '男性',
  dealerExperience: 'なし',
  dealerHistory: '',
  previousStore: '',
  dealerName: '',
  preferredStore: 'Poker Room Arkadia｜船橋店',
  phone: '09012345678',
  appeal: '接客経験があります。',
  interviewSlots: [
    { label: '第1希望', display: '12月03日（木）18時00分から19時00分までの間' },
    { label: '第2希望', display: '12月04日（金）終日可能' },
    { label: '第3希望', display: '12月05日（土）20時00分から21時30分までの間' }
  ],
  photoFileName: 'face.jpg',
  notes: 'よろしくお願いいたします。'
};

const payload = vm.runInContext(
  'buildRecruitmentFlexMessage(' + JSON.stringify(application) + ')',
  context
);
const altText = vm.runInContext(
  'buildApplicationAltText(' + JSON.stringify(application) + ')',
  context
);
const payloadWithPhoto = vm.runInContext(
  'buildRecruitmentFlexMessage(' + JSON.stringify(application) + ', ' + JSON.stringify({
    originalContentUrl: 'https://example.com/original.jpg',
    previewImageUrl: 'https://example.com/preview.jpg'
  }) + ')',
  context
);

assert.equal(altText, '求人応募｜Poker Room Arkadia｜船橋店');
assert.equal(vm.runInContext("calculateAge('2000-04-22', new Date(2026, 10, 27))", context), 26);
assert.equal(vm.runInContext("formatTimeJa('24:00')", context), '24時00分');
const timeOptions = vm.runInContext('createTimeOptions(12 * 60, 24 * 60)', context);
assert.equal(timeOptions.includes('value="12:00">12時00分'), true);
assert.equal(timeOptions.includes('value="12:30">12時30分'), true);
assert.equal(timeOptions.includes('value="12:15"'), false);
assert.equal(timeOptions.includes('value="24:00">24時00分'), true);
const dateOptions = vm.runInContext('createInterviewDateOptions()', context);
assert.equal((dateOptions.match(/<option/g) || []).length, 32);
assert.equal(payload.type, 'bubble');
assert.equal(payload.size, 'giga');
assert.equal(payload.header.contents[0].text, '求人応募');
assert.equal(payload.header.contents[1].text, 'Poker Room Arkadia｜船橋店');
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '希望勤務店舗')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '年齢')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '添付あり：face.jpg')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '12月04日（金）終日可能')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '12月03日（木）18時00分から19時00分までの間')), true);
assert.equal(payload.footer.contents[0].text, '応募者から送信されたフォーム内容です。');
assert.equal(JSON.stringify(payload).includes('email'), false);
assert.equal(payloadWithPhoto.hero.type, 'image');
assert.equal(payloadWithPhoto.hero.url, 'https://example.com/preview.jpg');
assert.equal(payloadWithPhoto.hero.action.uri, 'https://example.com/original.jpg');
assert.equal(JSON.stringify([
  { type: 'flex', altText, contents: payloadWithPhoto }
].map((message) => message.type)), JSON.stringify(['flex']));

console.log('PASS: 店舗名入りFlex通知文、Flex内画像、1通送信、日付範囲、30分刻み時刻、終日表示を確認');
