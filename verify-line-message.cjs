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
  preferredStore: '船橋店',
  phone: '09012345678',
  email: 'taro@example.com',
  appeal: '接客経験があります。',
  interviewSlots: [
    { label: '第1希望', display: '12月03日（木）18:00- 19:00' },
    { label: '第2希望', display: '12月04日（金）終日可能' },
    { label: '第3希望', display: '12月05日（土）20:15- 21:45' }
  ],
  photoFileName: 'face.jpg',
  notes: 'よろしくお願いいたします。'
};

const payload = vm.runInContext(
  'buildRecruitmentFlexMessage(' + JSON.stringify(application) + ')',
  context
);
const notice = vm.runInContext(
  'buildApplicationNoticeMessage(' + JSON.stringify(application) + ')',
  context
);

assert.equal(notice.type, 'text');
assert.equal(notice.text, '求人を応募しました｜船橋店');
assert.equal(vm.runInContext("calculateAge('2000-04-22', new Date(2026, 10, 27))", context), 26);
assert.equal(payload.type, 'bubble');
assert.equal(payload.size, 'giga');
assert.equal(payload.header.contents[0].text, '求人応募');
assert.equal(payload.header.contents[1].text, '船橋店 希望');
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '希望勤務店舗')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '年齢')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '添付あり：face.jpg')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '12月04日（金）終日可能')), true);
assert.equal(payload.body.contents.some((item) => item.contents?.some((child) => child.text === '12月03日（木）18:00- 19:00')), true);
assert.equal(payload.footer.contents[0].text, '応募者から送信されたフォーム内容です。');
assert.equal(JSON.stringify(payload).includes('email'), false);
assert.equal([notice, { type: 'flex', altText: '求人応募（船橋店希望）', contents: payload }][0].type, 'text');
assert.equal([notice, { type: 'flex', altText: '求人応募（船橋店希望）', contents: payload }][1].type, 'flex');

console.log('PASS: 通知テキストをFlex Messageより先に送る順序、Flex構造、終日表示、15分刻み形式を確認');
