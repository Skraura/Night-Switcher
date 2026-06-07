// Species codes: FS, SS, IR, ASD, BS, BW, BIO
// Growth stages: Hatchling, Juvenile, Adult, Elder, Bio
// Genders: Male, Female

export const MOCK_ACCOUNTS = [
  { id: '76561198000000001', name: 'NightRider',   accountName: 'nightrider99',   mostRecent: true,  avatar: null },
  { id: '76561198000000002', name: 'DragonSlayer', accountName: 'dragonslayer_x', mostRecent: false, avatar: null },
  { id: '76561198000000003', name: 'Kira',         accountName: 'kira_moonlight', mostRecent: false, avatar: null },
  { id: '76561198000000004', name: 'Vexor',        accountName: 'vexor',          mostRecent: false, avatar: null },
  { id: '76561198000000005', name: 'ShadowFang',   accountName: 'shadowfang_alt', mostRecent: false, avatar: null },
  { id: '76561198000000006', name: 'Lyria',        accountName: 'lyria',          mostRecent: false, avatar: null },
]

export const MOCK_DOD = {
  dragons: {
    '76561198000000001': [
      { dragon_id: 'd001', name: 'Ember',    gender: 'Female', species: 'FS',  growth: 'Adult',     is_dead: false, is_hungry: false },
      { dragon_id: 'd002', name: 'Ash',      gender: 'Male',   species: 'IR',  growth: 'Juvenile',  is_dead: false, is_hungry: true  },
      { dragon_id: 'd003', name: 'Cindra',   gender: 'Female', species: 'FS',  growth: 'Hatchling', is_dead: false, is_hungry: false },
    ],
    '76561198000000002': [
      { dragon_id: 'd004', name: 'Frostbite', gender: 'Male',   species: 'SS',  growth: 'Elder',    is_dead: false, is_hungry: false },
      { dragon_id: 'd005', name: 'Blizzard',  gender: 'Female', species: 'SS',  growth: 'Adult',    is_dead: false, is_hungry: true  },
      { dragon_id: 'd006', name: 'Shard',     gender: 'Male',   species: 'BW',  growth: 'Hatchling',is_dead: false, is_hungry: false },
      { dragon_id: 'd007', name: 'Tundra',    gender: 'Female', species: 'SS',  growth: 'Juvenile', is_dead: true,  is_hungry: false },
    ],
    '76561198000000003': [
      { dragon_id: 'd008', name: 'Stormcall', gender: 'Male',   species: 'ASD', growth: 'Adult',    is_dead: false, is_hungry: false },
      { dragon_id: 'd009', name: 'Volt',      gender: 'Female', species: 'ASD', growth: 'Juvenile', is_dead: false, is_hungry: false },
    ],
    '76561198000000004': [
      { dragon_id: 'd010', name: 'Venom',   gender: 'Male',   species: 'BS',  growth: 'Juvenile',  is_dead: false, is_hungry: true  },
      { dragon_id: 'd011', name: 'Toxica',  gender: 'Female', species: 'BS',  growth: 'Hatchling', is_dead: false, is_hungry: false },
      { dragon_id: 'd012', name: 'Blight',  gender: 'Male',   species: 'IR',  growth: 'Elder',     is_dead: false, is_hungry: true  },
      { dragon_id: 'd013', name: 'Murk',    gender: 'Female', species: 'BW',  growth: 'Adult',     is_dead: true,  is_hungry: false },
    ],
    '76561198000000005': [
      { dragon_id: 'd014', name: 'Nightshade', gender: 'Female', species: 'SS',  growth: 'Adult',   is_dead: false, is_hungry: false },
      { dragon_id: 'd015', name: 'Eclipse',    gender: 'Male',   species: 'IR',  growth: 'Juvenile',is_dead: false, is_hungry: false },
    ],
    '76561198000000006': [
      { dragon_id: 'd016', name: 'Solaris',  gender: 'Female', species: 'BIO', growth: 'Elder',     is_dead: false, is_hungry: false },
      { dragon_id: 'd017', name: 'Aurora',   gender: 'Female', species: 'BIO', growth: 'Adult',     is_dead: false, is_hungry: true  },
      { dragon_id: 'd018', name: 'Dawnfire', gender: 'Male',   species: 'FS',  growth: 'Hatchling', is_dead: false, is_hungry: false },
      { dragon_id: 'd019', name: 'Lumis',    gender: 'Male',   species: 'ASD', growth: 'Juvenile',  is_dead: false, is_hungry: false },
      { dragon_id: 'd020', name: 'Cinder',   gender: 'Female', species: 'BW',  growth: 'Adult',     is_dead: true,  is_hungry: false },
    ],
  },
  mappings: {},
}

let mockState = {
  accounts: structuredClone(MOCK_ACCOUNTS),
  dodData:  structuredClone(MOCK_DOD),
  settings: {},
}

export const mockApi = {
  window: { minimize: () => {}, maximize: () => {}, close: () => {} },
  steam: {
    getAccounts: async () => ({
      ok: true,
      steamPath: 'C:\\Program Files (x86)\\Steam',
      accounts: mockState.accounts,
    }),
    getActive:         async () => mockState.accounts.find(a => a.mostRecent) || null,
    getRunningGames:   async () => [],
    getInstalledGames: async () => [],
    switchAccount: async ({ accountName }) => {
      mockState.accounts = mockState.accounts.map(a => ({ ...a, mostRecent: a.accountName === accountName }))
      return { ok: true }
    },
  },
  dod: {
    read:   async () => mockState.dodData,
    action: async ({ dragonId, type }) => {
      for (const dragons of Object.values(mockState.dodData.dragons)) {
        const d = dragons.find(x => x.dragon_id === dragonId)
        if (!d) continue
        if (type === 'kill')   { d.growth = 'Hatchling'; d.is_dead = false }
        if (type === 'dead')   { d.is_dead = true }
        if (type === 'hungry') { d.is_hungry = !d.is_hungry }
      }
      return { ok: true }
    },
  },
  settings: {
    load: async () => mockState.settings,
    save: async (s) => { mockState.settings = { ...mockState.settings, ...s }; return { ok: true } },
  },
}
