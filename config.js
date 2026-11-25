window.VR_CONFIG = {

  live: {
    sheetId: '1KmJvICKMVe44DewudUdgdW9AhC_Rif83u6CwELpvZls',

    classFilter: {
      enabled: true,
      gid: '29911604',
      range: '',
      driverColumn: 'D',
      classColumn:  'A',
      allLabel: 'All Classes',
    },

    events: {
      sheetId: '1ghHvvVe4kNnkVUbYTsBHxrfB2MLH-erhOCvlOBbU3Uc',
      gid:     '1914616841',
    },
  },

  // RallyCross-format results (js/rxboard.js): the live board on /happening-now
  // (Live Calendar row of one of eventTypes with Live = Yes, or ?event=rx) and
  // archived events of those types on /past-events.
  rx: {
    // Event types (Live Calendar "type" / archive Index "EventType") whose
    // results use this format. Case and spaces don't matter.
    eventTypes: ['RallyCross', 'RallyChase'],

    sheetId: '11VG6EY8_0XvEbxc4OcKHPabpAUZ75gELDOv3T-dL_Ao',   // MASTER Streaming RX
    gid:     '1325113839',                                     // "Web" tab
    ranges: {
      qualifying: 'A1:G',   // Round | Heat | Class | No | Driver | Time | P
      knockouts:  'I1:P',   // Class | Race | Start | GridTime | No | Driver | Time | Finish
      settings:   'R1:S',   // Setting | Value
    },
    pollSeconds: 10,

    // "RallyCross Live Results Settings" tab in VR Website Settings (key/value rows).
    settingsSheetId: '1ghHvvVe4kNnkVUbYTsBHxrfB2MLH-erhOCvlOBbU3Uc',
    settingsGid:     '1774615058',

    // Used while the settings tab leaves Title / Date blank.
    defaults: {
      title: 'International RallyCross',
      date:  '28th November 2026',
    },
  },

  previous: {
    workbookId: '1MS1c8w8nRo-5hVPjl-IQRr9UMLNmDj8drFTpq-i3J7w',
    indexTabName: 'Index',
    indexColumns: {
      eventName: 'EventName',
      eventType: 'EventType',
      date:      'Date',
      tabName:   'TabName',
      pdfUrl:    'PdfUrl',
    },
  },

  weather: {
    lat: 13.17,
    lon: -59.58,
    timezone: 'America/Barbados',
    unit: 'celsius',          // 'celsius' | 'fahrenheit'
    label1: 'VAUCLUSE RACEWAY',
    label2: 'CURRENT WEATHER',
  },

  links: {
    mainSite:  'https://vaucluseraceway.com',
    instagram: 'https://instagram.com/vaucluse_raceway',
    whatsapp:  'https://www.whatsapp.com/channel/0029VbCVcLH2ZjCkxisZTd0l',
    designer:  'https://emdesignsbb.com',
  },
};
