// Challenges: a molecule in the scene completes a challenge when its Hill
// formula and net ion charge both match exactly.
//
// HOW TO ADD YOUR OWN — push another object into the list below:
//   { tier: 2, formula: 'C2H4', charge: 0, name: 'Ethene' }
//
//   tier    — groups rows in the Dex (any integer; rows are ordered as
//             listed here, so put new entries under the tier you want)
//   formula — EXACTLY the string shown in the app's "Molecule" panel.
//             Easiest way to get it right: build the molecule in the app,
//             copy the formula from the panel, paste it here.
//             Examples: 'H2O', 'CO2', 'O2', 'C6H6'
//   charge  — net ion charge as an integer; omit for neutral (0).
//             Ions look like: { formula: 'NH4+1', charge: 1, name: 'Ammonium ion' }
//             (the formula suffix must match what the panel shows)
//   name    — display name in the Dex; optional, falls back to the formula.
//   vi      — Vietnamese display name; optional, shown when the app language
//             is Vietnamese (falls back to `name`).
//
// Progress is stored per formula|charge pair, so renaming an entry keeps
// completion; changing formula or charge creates a fresh challenge.
// Malformed entries (missing/empty formula) are skipped with a console
// warning instead of breaking the Dex.
export const CHALLENGES = [
  // Tier 1: Simple diatomics and basic molecules
  { tier: 1, formula: 'H2O', charge: 0, name: 'Water', vi: 'Nước' },
  { tier: 1, formula: 'CO2', charge: 0, name: 'Carbon dioxide', vi: 'Cacbon dioxit' },
  { tier: 1, formula: 'CH4', charge: 0, name: 'Methane', vi: 'Metan' },
  { tier: 1, formula: 'NH3', charge: 0, name: 'Ammonia', vi: 'Amoniac' },
  { tier: 1, formula: 'O2', charge: 0, name: 'Dioxygen', vi: 'Đioxi' },
  { tier: 1, formula: 'N2', charge: 0, name: 'Dinitrogen', vi: 'Nitơ' },
  { tier: 1, formula: 'NaCl', charge: 0, name: 'Sodium chloride', vi: 'Natri clorua' },
  { tier: 1, formula: 'HCl', charge: 0, name: 'Hydrogen chloride', vi: 'Hiđro clorua' },
  { tier: 1, formula: 'CO', charge: 0, name: 'Carbon monoxide', vi: 'Cacbon monoxit' },
  { tier: 1, formula: 'H2', charge: 0, name: 'Dihydrogen', vi: 'Hiđro' },

  // Tier 2: Small hydrocarbons, common oxides, and binary salts
  { tier: 2, formula: 'C2H6', charge: 0, name: 'Ethane', vi: 'Etan' },
  { tier: 2, formula: 'C2H4', charge: 0, name: 'Ethene', vi: 'Eten' },
  { tier: 2, formula: 'C2H2', charge: 0, name: 'Ethyne', vi: 'Etin' },
  { tier: 2, formula: 'H2O2', charge: 0, name: 'Hydrogen peroxide', vi: 'Hiđro peroxit' },
  { tier: 2, formula: 'SO2', charge: 0, name: 'Sulfur dioxide', vi: 'Lưu huỳnh dioxit' },
  { tier: 2, formula: 'MgO', charge: 0, name: 'Magnesium oxide', vi: 'Magie oxit' },
  { tier: 2, formula: 'CaCl2', charge: 0, name: 'Calcium chloride', vi: 'Canxi clorua' },
  { tier: 2, formula: 'NaOH', charge: 0, name: 'Sodium hydroxide', vi: 'Natri hidroxit' },
  { tier: 2, formula: 'O3', charge: 0, name: 'Ozone', vi: 'Ozon' },
  { tier: 2, formula: 'HCN', charge: 0, name: 'Hydrogen cyanide', vi: 'Axit xianhiđric' },

  // Tier 3: Acids, standard polyatomic ions, and symmetric structures
  { tier: 3, formula: 'OH-1', charge: -1, name: 'Hydroxide ion', vi: 'Ion hidroxit' },
  { tier: 3, formula: 'NH4+1', charge: 1, name: 'Ammonium ion', vi: 'Ion amoni' },
  { tier: 3, formula: 'H3O+1', charge: 1, name: 'Hydronium ion', vi: 'Ion hidroni' },
  { tier: 3, formula: 'H2SO4', charge: 0, name: 'Sulfuric acid', vi: 'Axit sunfuric' },
  { tier: 3, formula: 'CaCO3', charge: 0, name: 'Calcium carbonate', vi: 'Canxi cacbonat' },
  { tier: 3, formula: 'NO3-1', charge: -1, name: 'Nitrate ion', vi: 'Ion nitrat' },
  { tier: 3, formula: 'SO4-2', charge: -2, name: 'Sulfate ion', vi: 'Ion sunfat' },
  { tier: 3, formula: 'SF6', charge: 0, name: 'Sulfur hexafluoride', vi: 'Lưu huỳnh hexaflorua' },
  { tier: 3, formula: 'C6H6', charge: 0, name: 'Benzene', vi: 'Benzên' },
  { tier: 3, formula: 'XeF4', charge: 0, name: 'Xenon tetrafluoride', vi: 'Xenon tetraflorua' },
  { tier: 3, formula: 'CH4O', charge: 0, name: 'Methanol', vi: 'Metanol' },
  { tier: 3, formula: 'C2H4O2', charge: 0, name: 'Acetic acid', vi: 'Axit axetic' },

  // Tier 4: Complex organic molecules, polyatomic ions, and higher-order fluorides
  { tier: 4, formula: 'PO4-3', charge: -3, name: 'Phosphate ion', vi: 'Ion photphat' },
  { tier: 4, formula: 'CO3-2', charge: -2, name: 'Carbonate ion', vi: 'Ion cacbonat' },
  { tier: 4, formula: 'C3H8', charge: 0, name: 'Propane', vi: 'Propan' },
  { tier: 4, formula: 'C4H10', charge: 0, name: 'Butane', vi: 'Butan' },
  { tier: 4, formula: 'C3H6O', charge: 0, name: 'Acetone', vi: 'Axeton' },
  { tier: 4, formula: 'C2H6O', charge: 0, name: 'Ethanol', vi: 'Etanol' },
  { tier: 4, formula: 'PF5', charge: 0, name: 'Phosphorus pentafluoride', vi: 'Photpho pentaflorua' },
  { tier: 4, formula: 'MnO4-1', charge: -1, name: 'Permanganate ion', vi: 'Ion pemanganat' },
  { tier: 4, formula: 'HNO3', charge: 0, name: 'Nitric acid', vi: 'Axit nitric' },
  { tier: 4, formula: 'H3PO4', charge: 0, name: 'Phosphoric acid', vi: 'Axit photphoric' },

  // Tier 5: Advanced multi-carbon structures, heavy elements, and complex ions
  { tier: 5, formula: 'C6H12O6', charge: 0, name: 'Glucose', vi: 'Glucozơ' },
  { tier: 5, formula: 'C8H18', charge: 0, name: 'Octane', vi: 'Octan' },
  { tier: 5, formula: 'Cr2O7-2', charge: -2, name: 'Dichromate ion', vi: 'Ion đicromat' },
  { tier: 5, formula: 'UF6', charge: 0, name: 'Uranium hexafluoride', vi: 'Urani hexaflorua' },
  { tier: 5, formula: 'CCl4', charge: 0, name: 'Carbon tetrachloride', vi: 'Cacbon tetraclorua' },
  { tier: 5, formula: 'CH2Cl2', charge: 0, name: 'Dichloromethane', vi: 'Điclometan' },
  { tier: 5, formula: 'CHO3-1', charge: -1, name: 'Bicarbonate ion', vi: 'Ion bicacbonat' },
  { tier: 5, formula: 'HSO4-1', charge: -1, name: 'Bisulfate ion', vi: 'Ion bisunfat' },

  // Tier 6: High-tier alkanes, complex halogenated compounds, and organic acids
  { tier: 6, formula: 'C5H12', charge: 0, name: 'Pentane', vi: 'Pentan' },
  { tier: 6, formula: 'C6H14', charge: 0, name: 'Hexane', vi: 'Hекsan' },
  { tier: 6, formula: 'C2H4O2', charge: 0, name: 'Methyl formate', vi: 'Metyl fomat' },
  { tier: 6, formula: 'C3H6O2', charge: 0, name: 'Methyl acetate', vi: 'Metyl axetat' },
  { tier: 6, formula: 'C2H5ClO', charge: 0, name: 'Hypochlorous ethylic ester', vi: 'Etyl hipoclorit' },
  { tier: 6, formula: 'C6H6O', charge: 0, name: 'Phenol', vi: 'Phenol' },
  { tier: 6, formula: 'C2O4-2', charge: -2, name: 'Oxalate ion', vi: 'Ion oxalat' },
  { tier: 6, formula: 'ClO4-1', charge: -1, name: 'Perchlorate ion', vi: 'Ion perclorat' },

  // Tier 7: Master Tier (Biomolecules, large rings, and complex functional architectures)
  { tier: 7, formula: 'C12H22O11', charge: 0, name: 'Sucrose', vi: 'Saccarozơ' },
  { tier: 7, formula: 'C5H10O5', charge: 0, name: 'Ribose', vi: 'Ribozơ' },
  { tier: 7, formula: 'C3H5N3O9', charge: 0, name: 'Nitroglycerin', vi: 'Nitroglycerin' },
  { tier: 7, formula: 'C2H5NO2', charge: 0, name: 'Glycine', vi: 'Glyxin' },
  { tier: 7, formula: 'C6H5NO2', charge: 0, name: 'Nicotinic acid (Niacin)', vi: 'Axit nicotinic' },
  { tier: 7, formula: 'Fe(CN)6-3', charge: -3, name: 'Ferricyanide ion', vi: 'Ion ferricyanua' },

  // Tier 8: Elite Tier (Polyfunctional organic structures, aromatic derivatives, and complex clusters)
  { tier: 8, formula: 'C7H8O', charge: 0, name: 'Benzyl alcohol', vi: 'Benzyl alcol' },
  { tier: 8, formula: 'C7H6O2', charge: 0, name: 'Benzoic acid', vi: 'Axit benzoic' },
  { tier: 8, formula: 'C8H10N4O2', charge: 0, name: 'Caffeine', vi: 'Caffeine' },
  { tier: 8, formula: 'C6H8O6', charge: 0, name: 'Ascorbic acid (Vitamin C)', vi: 'Axit ascorbic' },
  { tier: 8, formula: 'C3H8O3', charge: 0, name: 'Glycerol', vi: 'Glicerol' },
  { tier: 8, formula: 'Fe(CN)6-4', charge: -4, name: 'Ferrocyanide ion', vi: 'Ion ferrocyanua' },

  // Tier 9: Grandmaster Tier (Advanced biomolecules, structural isomers, and heavy coordination ions)
  { tier: 9, formula: 'C10H14N2O', charge: 0, name: 'Nicotine', vi: 'Nicotin' },
  { tier: 9, formula: 'C9H8O4', charge: 0, name: 'Aspirin', vi: 'Aspirin' },
  { tier: 9, formula: 'C6H13NO2', charge: 0, name: 'Leucine', vi: 'Leuxin' },
  { tier: 9, formula: 'C4H6O6', charge: 0, name: 'Tartaric acid', vi: 'Axit tartaric' },
  { tier: 9, formula: 'PtCl4-2', charge: -2, name: 'Tetrachloroplatinate ion', vi: 'Ion tetracloroplatinat' },

  // Tier 10: Legendary Tier (Ultra-complex macrostructures, synthetic milestones, and deep chemistry architectures)
  { tier: 10, formula: 'C16H18N2O4S', charge: 0, name: 'Penicillin G', vi: 'Penicillin G' },
  { tier: 10, formula: 'C20H25N3O', charge: 0, name: 'LSD', vi: 'LSD' },
  { tier: 10, formula: 'C17H19NO3', charge: 0, name: 'Morphine', vi: 'Moocphin' },
  { tier: 10, formula: 'Co(NH3)6+3', charge: 3, name: 'Hexaamminecobalt(III) ion', vi: 'Ion hexaamminecoban(III)' },

  // Tier 11: Industrial & Inorganic Compounds
  { tier: 11, formula: 'Fe2O3', charge: 0, name: 'Iron(III) oxide', vi: 'Sắt(III) oxit' },
  { tier: 11, formula: 'NO2', charge: 0, name: 'Nitrogen dioxide', vi: 'Nitơ dioxit' },
  { tier: 11, formula: 'HNO3', charge: 0, name: 'Nitric acid', vi: 'Axit nitric' },
  { tier: 11, formula: 'NaNO3', charge: 0, name: 'Sodium nitrate', vi: 'Natri nitrat' },
  { tier: 11, formula: 'KNO3', charge: 0, name: 'Potassium nitrate', vi: 'Kali nitrat' },
  { tier: 11, formula: 'CaSO4', charge: 0, name: 'Calcium sulfate', vi: 'Canxi sulfat' },
  { tier: 11, formula: 'ZnSO4', charge: 0, name: 'Zinc sulfate', vi: 'Kẽm sulfat' },
  { tier: 11, formula: 'AgNO3', charge: 0, name: 'Silver nitrate', vi: 'Bạc nitrat' },
  { tier: 11, formula: 'CuSO4', charge: 0, name: 'Copper(II) sulfate', vi: 'Đồng(II) sulfat' },
  { tier: 11, formula: 'CH4N2O', charge: 0, name: 'Urea', vi: 'Urê' },

  // Tier 12: Amino Acids & Coordination Compounds
  { tier: 12, formula: 'C3H7NO2', charge: 0, name: 'Alanine', vi: 'Alanin' },
  { tier: 12, formula: 'C5H11NO2', charge: 0, name: 'Valine', vi: 'Valin' },
  { tier: 12, formula: 'C3H7NO3', charge: 0, name: 'Serine', vi: 'Serin' },
  { tier: 12, formula: 'CuH12N4', charge: 2, name: 'Tetraamminecopper(II) ion', vi: 'Ion tetraamminedong(II)' },
  { tier: 12, formula: 'AgH6N2', charge: 1, name: 'Diamminesilver(I) ion', vi: 'Ion diamminebac(I)' }
];