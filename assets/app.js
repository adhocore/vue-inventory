/**
 * @author Jitendra Adhikari <jiten.adhikary at gmail dot com>
 */
class Store
{
  constructor(prefix) { this.prefix = prefix }

  get currentDate () { return localStorage.getItem(this.prefix + 'current-date') }

  set currentDate (value) { localStorage.setItem(this.prefix + 'current-date', value) }

  get template () { return { price: 0, quota: 0, currency: 'n/a' } }

  getMonthlyData (month) {
    let data = localStorage.getItem(this.prefix + month);

    if (data) return JSON.parse(data);

    const days = moment(month, 'YYYY-MM').daysInMonth();
    const tmpl = this.template;

    data = {};
    for (let i = 1; i <= days; i++) {
      data[month + '-' + (i < 10 ? '0' + i : i)] = { single: tmpl, double: tmpl };
    }

    return data;
  }

  setMonthlyData (month, data) { localStorage.setItem(this.prefix + month, JSON.stringify(data)) }

  setDailyData (day, type, set) {
    const month = day.substr(0, 7);
    let data = this.getMonthlyData(month);

    if (!data[day][type]) {
      data[day][type] = set;
    } else {
      data[day][type] = { ...data[day][type], ...set };
    }

    this.setMonthlyData(month, data);
  }
}

Vue.component('prompt', {
  template: '#prompt',

  delimiters: ['[[', ']]'],

  props: ['storage'],

  data() { return { opened: false, newValue: null, data: {}, max: null, error: false } },

  methods: {
    open (data, pos) {
      this.data = data;
      this.opened = true;
      this.newValue = data.value;
      this.$el.style.top  = (pos.top - 58) + 'px';
      this.$el.style.left = (pos.left - 118) + 'px';
    },

    close () { this.error = this.opened = false },

    update () {
      if (+this.newValue < 1 || isNaN(+this.newValue) || (this.data.max && this.newValue > this.data.max)) {
        return this.error = true;
      }
      this.error = false;

      // No change!
      if (+this.data.value === +this.newValue) {
        return this.close();
      }

      this.storage.setDailyData(this.data.fullDate, this.data.roomType, {
        [this.data.prop]: +this.newValue
      });

      this.$parent.updated.call(this.$parent, this.newValue);
      this.close();
    }
  }
});

Vue.component('calendar', {
  template: '#calendar-grid',

  delimiters: ['[[', ']]'],

  props: ['storage', 'roomTypes'],

  data () {
    const date = this.storage.currentDate || moment().format('YYYY-MM');

    return { date, monthlyData: {}, currentElem: null, moment: moment(date, 'YYYY-MM') };
  },

  computed: {
    month () { return this.moment.format('MMMM') },

    year () { return this.moment.format('YYYY') },

    totalDays () { return this.moment.daysInMonth() },

    daysOfWeek () {
      const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekEnds = { 0: 'weekend', 6: 'weekend' };
      const total = this.moment.daysInMonth();

      let days = [];
      let startIdx = weekDays.indexOf(this.moment.format('dddd'));

      for (let day = 1; day <= total; day++) {
        days.push({ name: weekDays[startIdx % 7], type: weekEnds[startIdx % 7] || 'weekday' });
        startIdx++;
      }

      return days;
    },

    daysOfMonth () {
      const total = this.moment.daysInMonth();
      let days = [];

      for (let day = 1; day <= total; day++) { days.push({ day }) }

      return days;
    },
  },

  created() { this.fetchData() },

  watch: {
    date () {
      this.moment = moment(this.date, 'YYYY-MM');
      this.storage.currentDate = this.date;

      this.fetchData();
    },
  },

  methods: {
    fetchData () { this.monthlyData = this.storage.getMonthlyData(this.date) },

    fetchIfOverlap (from, to) {
      const thisFrom = +this.moment.format('X');
      const thisTo = +moment(this.date + '-' + this.moment.daysInMonth(), 'YYYY-MM-DD').format('X');

      if (thisFrom <= to && from <= thisTo) { this.fetchData() }
    },

    showPrompt (event) {
      const elem = event.currentTarget || event.target;

      this.currentElem = elem;
      this.$refs.prompt.open(elem.dataset, elem.getBoundingClientRect());
    },

    scrollLeft () { document.getElementById('calendar-data').scrollLeft -= 1050 },

    scrollRight () { document.getElementById('calendar-data').scrollLeft += 1050 },

    updated (newValue) { this.currentElem.innerText = this.currentElem.dataset.value = newValue },

    addMonth () { this.date = this.moment.add(1, 'months').format('YYYY-MM') },

    addYear () { this.date = this.moment.add(1, 'years').format('YYYY-MM') },

    subMonth () { this.date = this.moment.subtract(1, 'months').format('YYYY-MM') },

    subYear () { this.date = this.moment.subtract(1, 'years').format('YYYY-MM') },
  },
});

const App = new Vue({
  el: '#app',

  delimiters: ['[[', ']]'],

  data: {
    fromDate: null,
    toDate: null,
    bulkPrice: null,
    bulkQuota: null,
    roomType: 'double',
    roomTypes: {
      single: {label: 'Single Room', inventory: 5},
      double: {label: 'Double Room', inventory: 5}
    },
    filterDays: ['*'],
    refineDays: [
      {value: '0,1,2,3,4,5,6', label: 'All days'},
      {value: '1', label: 'Mondays'},
      {value: '4', label: 'Thursdays'},
      {value: '0', label: 'Sundays'},
      {value: '1,2,3,4,5', label: 'All Weekdays'},
      {value: '2', label: 'Tuesdays'},
      {value: '5', label: 'Fridays'},
      {value: '6,0', label: 'All weekends'},
      {value: '3', label: 'Wednesdays'},
      {value: '6', label: 'Saturdays'},
    ],
    storage: new Store('hotel-calendar-'),
    currency: 'USD',
    saved: false,
    errors: null,
  },

  methods: {
    clear () {
      this.roomType = 'double';
      this.filterDays = ['*'];
      this.fromDate = this.toDate = this.bulkPrice = this.bulkQuota = null;
    },

    fromTimestamp () { return +moment(this.fromDate, 'YYYY-MM-DD').format('X') },

    toTimestamp () { return +moment(this.toDate, 'YYYY-MM-DD').format('X') },

    weekDayNum (date) { return moment(date, 'YYYY-MM-DD').format('e') },

    cancel () { this.clear() },

    validate ()  {
      let errors = [];
      if (isNaN(+this.bulkPrice) || +this.bulkPrice < 1) {
        errors.push('Price must be amount greater than 0');
      }

      const max = this.roomTypes[this.roomType].inventory;
      const num = +this.bulkQuota;
      if (isNaN(num) || num < 1 || num > max) {
        errors.push('Quota must be a number between 1 and ' + max);
      }

      if (errors.length) {
        this.errors = errors.join('. ');

        return false;
      }

      this.errors = null;

      return true;
    },

    bulkUpdate () {
      if (!this.validate.call(this)) {
        return;
      }

      const row = { price: +this.bulkPrice, quota: +this.bulkQuota, currency: this.currency };

      let day, month, dataset = {};
      let filterDays = this.filterDays.join(',').split(',');
      let allDay = filterDays.length === 0 || filterDays.indexOf('*') > -1;
      let from   = this.fromTimestamp(), to = this.toTimestamp();

      if (from > to) [from, to] = [to, from];

      while (from <= to) {
        day   = moment(from, 'X').format('YYYY-MM-DD');
        month = day.substr(0, 7);

        if (allDay || filterDays.indexOf(this.weekDayNum(day)) > -1) {
          if (!dataset[month]) dataset[month] = this.storage.getMonthlyData(month);
          dataset[month][day][this.roomType] = row;
        }

        from += 86400;
      }

      Object.keys(dataset).forEach(month => this.storage.setMonthlyData(month, dataset[month]));
      this.updated();
    },

    updated () {
      this.saved = true;
      setTimeout(() => this.saved = false, 2500);

      // Reload the calendar if the bulk date ranges overlap!
      this.$refs.calendar.fetchIfOverlap(this.fromTimestamp(), this.toTimestamp());
      this.clear();
    },
  }
});
