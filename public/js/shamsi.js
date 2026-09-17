/**
 * الگوریتم تبدیل تاریخ میلادی به شمسی (جلالی) و تقویم فارسی اختصاصی (Jalali Datepicker)
 */
const Shamsi = (function() {
  const j_month_names = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  function toPersianDigits(n) {
    if (n === null || n === undefined) return '';
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return n.toString().replace(/\d/g, x => farsiDigits[x]);
  }

  function getTodayJalali() {
    try {
      const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(new Date());
      const y = parts.find(p => p.type === 'year').value;
      const m = parts.find(p => p.type === 'month').value;
      const d = parts.find(p => p.type === 'day').value;
      return `${y}/${m}/${d}`;
    } catch (e) {
      const today = new Date();
      return fallbackGregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    }
  }

  function getTodayJalaliFull() {
    try {
      const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      return formatter.format(new Date());
    } catch (e) {
      return toPersianDigits(getTodayJalali());
    }
  }

  function fallbackGregorianToJalali(gy, gm, gd) {
    const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

    let g_day_no = 365 * (gy - 1600) + Math.floor((gy - 1599) / 4) - Math.floor((gy - 1501) / 100) + Math.floor((gy - 1500) / 400);
    for (let i = 0; i < gm - 1; ++i) g_day_no += g_days_in_month[i];
    if (gm > 2 && ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0))) g_day_no++;
    g_day_no += gd - 1;

    let j_day_no = g_day_no - 79;
    let j_np = Math.floor(j_day_no / 12053);
    j_day_no %= 12053;

    let jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
    j_day_no %= 1461;

    if (j_day_no >= 366) {
      jy += Math.floor((j_day_no - 1) / 365);
      j_day_no = (j_day_no - 1) % 365;
    }

    let jm = 0;
    for (let i = 0; i < 11 && j_day_no >= j_days_in_month[i]; ++i) {
      j_day_no -= j_days_in_month[i];
      jm = i + 1;
    }
    if (j_day_no >= j_days_in_month[jm]) {
      j_day_no -= j_days_in_month[jm];
      jm++;
    }
    jm++;
    const jd = j_day_no + 1;

    const mStr = jm < 10 ? '0' + jm : jm;
    const dStr = jd < 10 ? '0' + jd : jd;
    return `${jy}/${mStr}/${dStr}`;
  }

  function jalaliToGregorian(jy, jm, jd) {
    let sal_a = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy2 = (jy <= 979) ? 0 : 979;
    jy -= jy2;
    let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 1600 + 400 * Math.floor(days / 146097);
    days %= 146097;
    let leap = true;
    if (days >= 36525) {
      days--;
      gy += 100 * Math.floor(days / 36524);
      days %= 36524;
      if (days >= 365) days++;
      else leap = false;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    if (days >= 366) {
      leap = false;
      days--;
      gy += Math.floor(days / 365);
      days %= 365;
    }
    let i = 0;
    for (; days >= sal_a[i] + (i > 1 && leap ? 1 : 0); i++);
    let gm = i;
    let gd = days - sal_a[i - 1] - (i > 2 && leap ? 1 : 0) + 1;
    return new Date(gy, gm - 1, gd);
  }

  function isJalaliLeapYear(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    let blen = breaks.length;
    let jp = breaks[0];
    if (jy < jp || jy >= breaks[blen - 1]) return false;
    let i = 1;
    for (; i < blen; i++) {
      if (jy < breaks[i]) break;
    }
    let N = jy - breaks[i - 1];
    let leapJ = N % 33;
    return [1, 5, 9, 13, 17, 22, 26, 30].includes(leapJ);
  }

  function getJalaliMonthDays(jy, jm) {
    if (jm >= 1 && jm <= 6) return 31;
    if (jm >= 7 && jm <= 11) return 30;
    if (jm === 12) return isJalaliLeapYear(jy) ? 30 : 29;
    return 30;
  }

  function formatShortDate(isoOrDateStr) {
    if (!isoOrDateStr) return '-';
    if (typeof isoOrDateStr === 'string' && isoOrDateStr.includes('/')) {
      return toPersianDigits(isoOrDateStr);
    }
    try {
      const d = new Date(isoOrDateStr);
      if (isNaN(d.getTime())) return toPersianDigits(isoOrDateStr);
      const formatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      const parts = formatter.formatToParts(d);
      const y = parts.find(p => p.type === 'year').value;
      const m = parts.find(p => p.type === 'month').value;
      const day = parts.find(p => p.type === 'day').value;
      return toPersianDigits(`${y}/${m}/${day}`);
    } catch (e) {
      return toPersianDigits(isoOrDateStr);
    }
  }

  function formatDate(isoOrDateStr) {
    return formatShortDate(isoOrDateStr);
  }

  return {
    monthNames: j_month_names,
    toPersianDigits,
    getTodayJalali,
    getTodayJalaliFull,
    formatDate,
    formatShortDate,
    jalaliToGregorian,
    getJalaliMonthDays
  };
})();

// -------------------------------------------------------------
// STANDALONE JALALI DATEPICKER CONTROLLER
// -------------------------------------------------------------
let dpActiveInput = null;
let dpViewYear = 1405;
let dpViewMonth = 6;

function openDatePicker(inputEl) {
  dpActiveInput = inputEl;
  let val = inputEl.value.trim();

  // Convert Persian digits in input to Latin if present
  val = val.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

  if (val && val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 3) {
      dpViewYear = parseInt(parts[0], 10) || 1405;
      dpViewMonth = parseInt(parts[1], 10) || 6;
    }
  } else {
    const todayStr = Shamsi.getTodayJalali();
    const parts = todayStr.split('/');
    dpViewYear = parseInt(parts[0], 10);
    dpViewMonth = parseInt(parts[1], 10);
  }

  dpInitSelectors();
  dpRenderGrid();

  const modal = document.getElementById('modal-datepicker');
  if (modal) modal.classList.remove('hidden');
}

function closeDatePicker() {
  const modal = document.getElementById('modal-datepicker');
  if (modal) modal.classList.add('hidden');
  dpActiveInput = null;
}

function closeDatePickerOnOverlay(e) {
  if (e.target.id === 'modal-datepicker') {
    closeDatePicker();
  }
}

function dpInitSelectors() {
  const monthSel = document.getElementById('dp-month-select');
  const yearSel = document.getElementById('dp-year-select');
  if (!monthSel || !yearSel) return;

  monthSel.innerHTML = Shamsi.monthNames.map((name, idx) => 
    `<option value="${idx + 1}" ${idx + 1 === dpViewMonth ? 'selected' : ''}>${name}</option>`
  ).join('');

  const currentYear = dpViewYear;
  const years = [];
  for (let y = currentYear - 5; y <= currentYear + 10; y++) {
    years.push(y);
  }

  yearSel.innerHTML = years.map(y => 
    `<option value="${y}" ${y === dpViewYear ? 'selected' : ''}>${Shamsi.toPersianDigits(y)}</option>`
  ).join('');
}

function dpChangeMonthYear() {
  const monthSel = document.getElementById('dp-month-select');
  const yearSel = document.getElementById('dp-year-select');
  if (monthSel && yearSel) {
    dpViewMonth = parseInt(monthSel.value, 10);
    dpViewYear = parseInt(yearSel.value, 10);
    dpRenderGrid();
  }
}

function dpPrevMonth() {
  dpViewMonth--;
  if (dpViewMonth < 1) {
    dpViewMonth = 12;
    dpViewYear--;
  }
  dpInitSelectors();
  dpRenderGrid();
}

function dpNextMonth() {
  dpViewMonth++;
  if (dpViewMonth > 12) {
    dpViewMonth = 1;
    dpViewYear++;
  }
  dpInitSelectors();
  dpRenderGrid();
}

function dpRenderGrid() {
  const grid = document.getElementById('dp-days-grid');
  if (!grid) return;

  const totalDays = Shamsi.getJalaliMonthDays(dpViewYear, dpViewMonth);
  const firstDayGregorian = Shamsi.jalaliToGregorian(dpViewYear, dpViewMonth, 1);
  const firstDayWeekday = (firstDayGregorian.getDay() + 1) % 7; // 0: Sat, 1: Sun... 6: Fri

  const todayStr = Shamsi.getTodayJalali();
  const selectedVal = dpActiveInput ? dpActiveInput.value.trim() : '';

  let html = '';

  for (let i = 0; i < firstDayWeekday; i++) {
    html += `<div></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dayStr = day < 10 ? '0' + day : '' + day;
    const monthStr = dpViewMonth < 10 ? '0' + dpViewMonth : '' + dpViewMonth;
    const fullJalaliStr = `${dpViewYear}/${monthStr}/${dayStr}`;

    const isToday = fullJalaliStr === todayStr;
    const isSelected = selectedVal.includes(fullJalaliStr);

    let btnClasses = "w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-xs transition mx-auto ";
    if (isSelected) {
      btnClasses += "bg-indigo-600 text-white font-bold shadow-md scale-105";
    } else if (isToday) {
      btnClasses += "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800";
    } else {
      btnClasses += "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700";
    }

    html += `
      <button type="button" onclick="dpSelectDay('${fullJalaliStr}')" class="${btnClasses}">
        ${Shamsi.toPersianDigits(day)}
      </button>
    `;
  }

  grid.innerHTML = html;
}

function dpSelectDay(jalaliStr) {
  if (dpActiveInput) {
    dpActiveInput.value = jalaliStr;
    dpActiveInput.dispatchEvent(new Event('input', { bubbles: true }));
    dpActiveInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  closeDatePicker();
}

function dpSelectToday() {
  const todayStr = Shamsi.getTodayJalali();
  dpSelectDay(todayStr);
}

function dpClear() {
  if (dpActiveInput) {
    dpActiveInput.value = '';
    dpActiveInput.dispatchEvent(new Event('input', { bubbles: true }));
    dpActiveInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
  closeDatePicker();
}
