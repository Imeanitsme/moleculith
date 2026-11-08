// Beta-plus decay: the measured half-lives of the proton-rich nuclides.
//
// The proton gun builds the mirror image of what the neutron gun builds. A shot
// adds a proton and a mass number while the neutron count stands still, so the
// nucleus it leaves behind sits below the band of stability instead of above it,
// and it gets rid of the excess the other way round: a proton turns into a
// neutron, the atom gives up a positron and a neutrino, and the element drops by
// one while the mass number stays exactly where it was.
//
// Like the beta-minus table this is a data table and not a model. A positron
// half-life is set by the weak interaction and by the gap between two nuclear
// mass surfaces; deriving it from first principles needs the shell model, and a
// game that guessed would be guessing at 109.8 minutes for fluorine-18 and
// getting potassium-40 wrong by orders of magnitude. So the numbers here are
// measured, and the engine counts them down.
//
// What it pays for is a second reason to run the proton gun at all. Fluorine-18,
// carbon-11, nitrogen-13, oxygen-15, gallium-68 - the positron emitters that PET
// scanners are built on - are all nuclei this build can now make and then watch
// decay, and a positron that slows down in matter meets an electron and the two
// turn into a pair of 511 keV gamma rays. That annihilation is the flash this
// file's decays draw on screen.
//
//   - The values come from the IAEA live chart of nuclides as published in the
//     Orciument/nuclide-data dump (3367 nuclides, February 2023), the same source
//     as the beta-minus table. That project says plainly that its compilation
//     should not be used for scientific work, and this is not scientific work -
//     but the textbook cases a player can actually build were checked against the
//     published values by hand, and they agree: 11C 20.36 min, 13N 9.965 min,
//     15O 122.24 s, 18F 109.77 min, 22Na 2.602 y, 26Al 7.17e5 y, 64Cu 12.70 h,
//     68Ga 67.71 min, 82Rb 75.45 s, 89Zr 78.41 h, 124I 4.18 d.
//   - One row per nuclide and one daughter per row. The dump prints the dominant
//     mode, and this build takes that branch every time instead of rolling
//     branching ratios, so copper-64 always lands on nickel-64 even though 39% of
//     real copper-64 decays go the other way to zinc-64. The same single-branch
//     simplification the beta-minus table already makes.
//
// Four exclusions, all deliberate:
//   - pure electron capture (the dump's "EC", 96 nuclides at or below lead, every
//     one of them measured). It reaches the same daughter by a different process - no
//     positron, just a neutrino and the atom's own X rays. A build that counted it
//     here would have to draw an electron falling into the nucleus rather than a
//     positron flying out of it, and that is a different feature with a different
//     flash and a different sentence. So this table speaks only about positron
//     emission and keeps silent about the rest.
//   - double positron emission and double electron capture ("2B+", "2EC"). Other
//     processes, two protons lighter, and half-lives nobody has ever measured.
//   - single proton and two-proton emission ("P", "2P"). The proton dripline
//     shreds the nucleus instead of nudging it one step, and the build's fission
//     countdown already covers everything heavy enough to try it.
//   - bismuth and up, Z 83 and over. Those nuclei are already owned by the
//     build's own alpha/beta chain, keyed to the proton number, and two rules for
//     the same nucleus is one too many. This table stops where that one starts:
//     nothing here is a row the engine would refuse to count down, and nothing
//     the panel promises is a clock the engine does not run.
(function () {
  'use strict';

  // One row per positron-emitting nuclide, "Z*1000+A:halfLifeSeconds". When the
  // decay is not a plain positron emission the number of protons shed with it is
  // stamped into the key: "8013+1" is oxygen-13, which emits a positron and then
  // throws a proton, so its daughter is carbon-12 rather than nitrogen-13. Those
  // are the beta-delayed-proton cases - 2 of them here, the mirror of the
  // delayed neutrons the beta-minus table stamps the same way.
  const PLUS_ROWS = (
    '5008:0.77000 6009:0.12650 6010:19.290 6011:1221.8 7012:0.011000 7013:597.90 8013+1:0.0085800 8014:70.606 ' +
    '8015:122.24 9017:64.490 9018:6586.2 10017:0.10920 10018:1.6720 10019:17.220 11021:22.490 11022:8.2105e+7 ' +
    '12020:0.090400 12021:0.12200 12022:3.8755 12023:11.305 13022:0.091100 13023:0.44600 13024:2.0530 13025:7.1830 ' +
    '13026:2.2626e+13 14022:0.029000 14023:0.042300 14024:0.14000 14025:0.22000 14026:2.2453 14027:4.1500 15026:0.043700 ' +
    '15027:0.26000 15028:0.27030 15029:4.1420 15030:149.88 16027:0.015500 16028:0.12500 16029:0.18800 16030:1.1780 ' +
    '16031:2.5534 17031:0.19000 17032:0.29800 17033:2.5110 17034:1.5266 18032:0.098000 18033:0.17300 18034:0.84380 ' +
    '18035:1.7756 19035:0.17800 19036:0.34100 19037:1.2250 19038:459.06 20035:0.025700 20036:0.10120 20037:0.18110 ' +
    '20038:0.44376 20039:0.86030 21040:0.18230 21041:0.59630 21042:0.68079 21043:14008 21044:14292 22039:0.028500 ' +
    '22040:0.052400 22041:0.081900 22042:0.20865 22043:0.50900 22045:11088 23043:0.079300 23044:0.11100 23045:0.54700 ' +
    '23046:0.42250 23047:1956.0 23048:1.3802e+6 23050:8.3626e+24 24042:0.013300 24043:0.021200 24044:0.042800 24045:0.060900 ' +
    '24046:0.26000 24047:0.50000 24048:77616 24049:2538.0 25046:0.036200 25047:0.10000 25048:0.15770 25049:0.38200 ' +
    '25050:0.28319 25051:2772.0 25052:4.8306e+5 25054:2.6974e+7 26046:0.013000 26047:0.021800 26048:0.045500 26049:0.064700 ' +
    '26050:0.15200 26051:0.30500 26052:29790 26053:510.60 27050:0.038800 27051:0.068800 27052:0.10400 27053:0.24000 ' +
    '27054:0.19328 27055:63108 27056:6.6732e+6 27058:6.1223e+6 28049:0.0075000 28050:0.018500 28051:0.023800 28052:0.040800 ' +
    '28053:0.055200 28054:0.11420 28055:0.20470 28056:5.2488e+5 28057:1.2816e+5 28059:2.3983e+12 29055:0.040000 29056:0.093000 ' +
    '29057:0.19630 29058:3.2040 29059:81.500 29060:1422.0 29061:12020 29062:580.20 29064:45722 30055:0.020000 ' +
    '30056:0.030000 30057:0.040000 30058:0.086700 30059:0.17860 30060:142.80 30061:89.100 30062:33095 30063:2308.2 ' +
    '30065:2.1076e+7 31060:0.070000 31061:0.16700 31062:0.11612 31063:32.400 31064:157.62 31065:912.00 31066:34164 ' +
    '31068:4062.6 32060:1.1e-7 32061:0.044000 32062:0.12900 32063:0.15000 32064:63.700 32065:30.900 32066:8136.0 ' +
    '32067:1134.0 32069:1.4058e+5 33064:0.069000 33065:0.12800 33066:0.095770 33067:42.500 33068:151.60 33069:912.00 ' +
    '33070:3156.0 33071:2.3508e+5 33072:93600 33074:1.5353e+6 34065:0.033000 34067:0.13600 34068:35.500 34069:27.400 ' +
    '34070:2466.0 34071:284.40 34073:25740 35070:0.079100 35071:21.400 35072:78.600 35073:204.00 35074:1524.0 ' +
    '35075:5802.0 35076:58320 35077:2.0534e+5 35078:387.00 36069:0.028000 36070:0.040000 36071:0.10000 36072:17.100 ' +
    '36073:27.300 36074:690.00 36075:276.00 36076:53280 36077:4275.0 36079:1.2614e+5 37072:1.03e-7 37074:0.064776 ' +
    '37075:19.000 37076:36.500 37077:226.80 37078:1059.6 37079:1374.0 37080:33.400 37081:16459 37082:75.450 ' +
    '37084:2.8356e+6 38073:0.025000 38074:0.027000 38075:0.088000 38076:7.8900 38077:9.0000 38078:160.00 38079:135.00 ' +
    '38080:6378.0 38081:1338.0 38083:1.1668e+5 39076:2e-7 39077:0.057000 39078:0.053000 39079:14.800 39080:30.100 ' +
    '39081:70.400 39082:8.3000 39083:424.80 39084:2370.0 39085:9648.0 39086:53064 39087:2.8728e+5 39088:9.2125e+6 ' +
    '40078:1.7e-7 40079:0.056000 40080:4.6000 40081:5.5000 40082:32.000 40083:42.000 40084:1548.0 40085:471.60 ' +
    '40086:59400 40087:6048.0 40089:2.8228e+5 41081:2e-7 41082:0.050000 41083:3.9000 41084:9.8000 41085:20.500 ' +
    '41086:88.000 41087:222.00 41088:870.00 41089:7308.0 41090:52560 41091:2.1459e+10 41092:1.095e+15 42081:4.5e-7 ' +
    '42083:0.0060000 42084:2.3000 42085:3.2000 42086:19.100 42087:14.100 42088:480.00 42089:126.60 42090:20016 ' +
    '42091:929.40 43086:0.055000 43087:2.2000 43088:6.4000 43089:12.800 43091:188.40 43092:255.00 43093:9900.0 ' +
    '43094:17580 43095:72000 43096:3.6979e+5 44086:4.38e-7 44088:1.2000 44089:1.3200 44090:11.700 44091:8.0000 ' +
    '44092:219.00 44093:59.700 44095:5914.8 44097:2.4451e+5 45089:1.2e-7 45090:0.029000 45091:1.4700 45092:4.6600 ' +
    '45093:12.200 45094:70.600 45095:301.20 45096:594.00 45097:1842.0 45098:523.20 45099:1.391e+6 45100:73800 ' +
    '45102:1.7911e+7 46092:1.0000 46093:1.0000 46094:9.0000 46095:5.0000 46096:122.00 46097:186.00 46098:1062.0 ' +
    '46099:1284.0 46101:30492 47093:2.28e-7 47094:0.026000 47095:1.7500 47096:4.4000 47098:47.500 47099:124.00 ' +
    '47100:120.60 47101:666.00 47102:774.00 47103:3942.0 47104:4152.0 47105:3.5675e+6 47106:1437.6 48094:7.6e-7 ' +
    '48095:0.032000 48096:1.0300 48098:9.3000 48099:16.000 48100:49.100 48101:81.600 48102:330.00 48103:438.00 ' +
    '48104:3462.0 48105:3330.0 48107:23400 49097:0.036000 49098:0.030000 49099+1:3.1000 49100:5.6500 49101:15.100 ' +
    '49102:23.300 49103:65.000 49104:108.00 49105:304.20 49106:372.00 49107:1944.0 49108:3480.0 49109:14972 ' +
    '49110:17712 49112:892.80 50099:7.6e-7 50100:1.1800 50101:1.7000 50102:3.8000 50103:7.0000 50104:20.800 ' +
    '50105:32.700 50106:115.00 50107:174.00 50108:618.00 50109:1086.0 50111:2118.0 50113:9.9438e+6 51104:0.44000 ' +
    '51105:1.2200 51106:0.60000 51107:4.0000 51108:7.4000 51109:17.200 51110:23.600 51111:75.000 51112:53.500 ' +
    '51113:400.20 51114:209.40 51115:1926.0 51116:948.00 51117:10080 51118:216.00 51120:953.40 52108:2.1000 ' +
    '52109:4.4000 52110:18.600 52111:19.300 52112:120.00 52113:102.00 52114:912.00 52115:348.00 52116:8964.0 ' +
    '52117:3720.0 52119:57780 52121:1.6563e+6 53110:0.66400 53111:2.5000 53112:3.3400 53113:6.6000 53114:2.1000 ' +
    '53115:78.000 53116:2.9100 53117:133.20 53118:822.00 53119:1146.0 53120:4896.0 53121:7632.0 53122:217.80 ' +
    '53123:47603 53124:3.6081e+5 53126:1.1172e+6 54112:2.7000 54113:2.7400 54114:10.000 54115:18.000 54116:59.000 ' +
    '54117:61.000 54118:228.00 54119:348.00 54120:2400.0 54121:2406.0 54123:7380.0 54125:60840 55114:0.57000 ' +
    '55115:1.4000 55116:0.70000 55117:8.4000 55118:14.000 55119:43.000 55120:61.300 55121:155.00 55122:21.180 ' +
    '55123:351.60 55124:30.900 55125:2802.0 55126:98.580 55127:22500 55128:218.40 55129:1.1542e+5 55130:1752.6 ' +
    '55132:5.5987e+5 56114:0.43000 56115:0.45000 56116:1.3000 56117:1.7500 56118:5.5000 56119:5.4000 56120:24.000 ' +
    '56121:29.700 56122:117.00 56123:144.00 56124:660.00 56125:198.00 56126:6000.0 56127:762.00 56129:8028.0 ' +
    '56131:9.936e+5 57120:2.8000 57121:5.3000 57122:8.6000 57123:16.300 57124:21.000 57125:64.800 57126:54.000 ' +
    '57127:306.00 57129:696.00 57130:522.00 57131:3540.0 57132:17280 57133:14083 57134:387.00 57135:70200 ' +
    '57136:592.20 57138:3.2504e+18 58121:1.1000 58123:3.8000 58124:6.0000 58125:9.7000 58126:51.000 58127:34.000 ' +
    '58128:235.80 58129:210.00 58130:1374.0 58131:618.00 58132:12636 58133:5820.0 58135:63720 58137:32400 ' +
    '59124:1.2000 59125:3.3000 59126:3.1400 59127:4.2000 59128:2.8400 59129:30.000 59130:40.000 59131:90.600 ' +
    '59132:96.000 59133:390.00 59134:1020.0 59135:1440.0 59136:786.00 59137:4608.0 59138:87.000 59139:15876 ' +
    '59140:203.40 60125:0.65000 60127:1.8000 60128:5.0000 60129:6.7000 60130:13.000 60131:25.400 60132:94.000 ' +
    '60133:70.000 60134:510.00 60135:744.00 60136:3039.0 60137:2310.0 60138:18144 60139:1782.0 60141:8964.0 ' +
    '61129:2.4000 61130:2.6000 61131:6.3000 61132:6.2000 61133:13.500 61134:5.0000 61135:49.000 61136:300.00 ' +
    '61137:144.00 61138:10.000 61139:249.00 61140:9.2000 61141:1254.0 61142:40.500 61143:2.2896e+7 61144:3.1363e+7 ' +
    '62129:0.55000 62131:1.2000 62132:4.0000 62133:2.8900 62134:9.5000 62135:10.300 62136:47.000 62137:45.000 ' +
    '62138:186.00 62139:154.20 62140:889.20 62141:612.00 62142:4349.4 62143:525.00 63134:0.50000 63135:1.5000 ' +
    '63136:3.3000 63137:11.000 63138:12.100 63139:17.900 63140:1.5100 63141:40.700 63142:2.3400 63143:155.40 ' +
    '63144:10.200 63145:5.1235e+5 63146:3.983e+5 63148:4.7088e+6 63150:1.1645e+9 63152:4.2655e+8 64135:1.1000 64136:2e-7 ' +
    '64137:2.2000 64138:4.7000 64139:5.8000 64140:15.800 64141:14.000 64142:70.200 64143:39.000 64144:268.20 ' +
    '64145:1380.0 64146:4.1705e+6 64147:1.3702e+5 64149:8.0179e+5 65138:2e-7 65139:1.6000 65140:2.2900 65141:3.5000 ' +
    '65142:0.59700 65143:12.000 65144:1.0000 65146:8.0000 65147:5904.0 65148:3600.0 65149:14825 65150:12528 ' +
    '65151:63392 65152:63000 65153:2.0218e+5 65154:77400 65156:4.6224e+5 65158:5.6802e+9 66139:0.60000 66141:0.90000 ' +
    '66142:2.3000 66143:5.6000 66144:9.1000 66145:6.0000 66146:33.200 66147:67.000 66148:198.00 66149:252.00 ' +
    '66150:430.20 66151:1074.0 66152:8568.0 66153:23040 66155:35640 66157:29304 67142:0.40000 67144:0.70000 ' +
    '67145:2.4000 67146:3.3200 67147:5.8000 67148:2.2000 67149:21.100 67150:72.000 67151:35.200 67152:161.80 ' +
    '67153:120.60 67154:705.60 67155:2880.0 67156:3360.0 67157:756.00 67158:678.00 67159:1983.0 67160:1536.0 ' +
    '67162:900.00 67164:1728.0 68144:2e-7 68146:1.7000 68147:3.2000 68148:4.6000 68149:4.0000 68150:18.500 ' +
    '68151:23.500 68154:223.80 68155:318.00 68156:1170.0 68157:1119.0 68159:2160.0 68161:11556 68163:4500.0 ' +
    '69147:0.58000 69148:0.70000 69149:0.90000 69150:2.2000 69151:4.1700 69152:8.0000 69155:21.600 69156:83.800 ' +
    '69157:217.80 69158:238.80 69159:547.80 69160:564.00 69161:1812.0 69162:1302.0 69163:6516.0 69164:117.00 ' +
    '69165:1.0822e+5 69166:27720 69168:8.0438e+6 70149:0.70000 70150:2e-7 70151:1.6000 70152:3.0300 70153:4.2000 ' +
    '70156:26.100 70157:38.600 70158:89.400 70159:100.20 70160:288.00 70161:252.00 70162:1132.2 70163:663.00 ' +
    '70165:594.00 70167:1050.0 71152:0.70000 71153:0.90000 71158:10.600 71159:12.100 71160:36.100 71161:77.000 ' +
    '71162:82.200 71163:238.20 71164:188.40 71165:644.40 71166:159.00 71167:3090.0 71168:330.00 71169:1.2262e+5 ' +
    '71170:1.7384e+5 71171:7.1254e+5 71172:5.7888e+5 71174:1.0445e+8 72154:2.0000 72155:0.84300 72158:2.8500 72159:5.6000 ' +
    '72160:13.600 72161:18.400 72162:39.400 72163:40.000 72164:111.00 72165:76.000 72166:406.20 72167:123.00 ' +
    '72168:1557.0 72169:194.40 72171:43560 72173:84960 73159:0.83000 73162:3.5700 73163:10.600 73164:14.200 ' +
    '73165:31.000 73166:34.400 73167:80.000 73168:120.00 73169:294.00 73170:405.60 73171:1398.0 73172:2208.0 ' +
    '73173:11304 73174:4104.0 73175:37800 73176:29124 73177:2.029e+5 73178:8496.0 74162:1.1900 74163:2.6700 ' +
    '74164:6.3000 74165:5.1000 74166:19.200 74167:19.900 74168:50.900 74169:74.000 74170:145.20 74171:142.80 ' +
    '74172:396.00 74173:456.00 74174:1992.0 74175:2112.0 74177:7944.0 74179:2223.0 75163:0.39000 75165:1.6000 ' +
    '75166:2.2500 75167:5.9000 75168:4.4000 75169:8.1000 75170:9.2000 75171:15.200 75172:15.000 75173:118.80 ' +
    '75174:144.00 75175:353.40 75176:318.00 75177:840.00 75178:792.00 75179:1170.0 75180:147.60 75181:71640 ' +
    '75182:2.3112e+5 75184:3.0586e+6 76168:2.1000 76169:3.4300 76170:7.3700 76171:8.3000 76172:19.200 76173:22.400 ' +
    '76175:84.000 76176:216.00 76177:180.00 76178:300.00 76179:390.00 76180:1290.0 76181:6300.0 76183:46800 ' +
    '77170:0.87000 77171:3.2000 77172:4.4000 77173:9.0000 77175:9.0000 77176:8.7000 77177:29.800 77178:12.000 ' +
    '77179:79.000 77180:90.000 77181:294.00 77182:900.00 77183:3480.0 77184:11124 77185:51840 77186:59904 ' +
    '77187:37800 77188:1.494e+5 77190:1.0178e+6 78176:6.3300 78177:10.000 78178:20.700 78179:21.200 78180:56.000 ' +
    '78181:52.000 78182:160.20 78183:390.00 78184:1038.0 78185:4254.0 78186:7488.0 78187:8460.0 78188:8.7782e+5 ' +
    '78189:39132 79177:1.5010 79178:2.6000 79179:7.1000 79180:8.4000 79181:13.700 79182:15.500 79183:42.800 ' +
    '79184:20.600 79185:255.00 79186:642.00 79187:498.00 79188:530.40 79189:1722.0 79190:2568.0 79191:11448 ' +
    '79192:17784 79193:63540 79194:1.3687e+5 79196:5.3282e+5 80180:2.5900 80181:3.6000 80182:10.830 80183:9.4000 ' +
    '80184:30.870 80185:49.100 80186:82.800 80187:114.00 80188:195.00 80189:456.00 80190:1200.0 80191:2940.0 ' +
    '80193:13680 80195:37908 81180:1.0900 81182:3.1000 81183:6.9000 81184:10.100 81185:19.500 81186:27.500 ' +
    '81187:51.000 81188:71.000 81189:138.00 81190:156.00 81192:576.00 81193:1296.0 81194:1980.0 81195:4176.0 ' +
    '81196:6624.0 81197:10224 81198:19080 81199:26712 81200:93960 81202:1.0636e+6 82186:4.8200 82187:15.200 ' +
    '82188:25.500 82189:39.000 82190:71.000 82191:79.800 82192:210.00 82194:642.00 82195:900.00 82196:2220.0 ' +
    '82197:486.00 82198:8640.0 82199:5400.0 82201:33588'
  ).split(' ');

  // key = Z * 1000 + A  ->  { t: half-life in seconds, m: 0 plain positron
  // emission, 1 proton shed with it }
  const TABLE = /* @__PURE__ */ new Map();
  for (const row of PLUS_ROWS) {
    const cut = row.indexOf(':');
    if (cut <= 0) continue;
    const head = row.slice(0, cut);
    const plus = head.indexOf('+');
    const key = Number(plus > 0 ? head.slice(0, plus) : head);
    const mode = plus > 0 ? Number(head.slice(plus + 1)) : 0;
    const t = Number(row.slice(cut + 1));
    if (!(key > 0) || !(t > 0) || !isFinite(t)) continue;
    TABLE.set(key, { t: t, m: mode === 1 ? 1 : 0 });
  }

  // The nuclides the same dump lists as stable, byte for byte the list the
  // beta-minus table carries, so that a positron chain comes to rest on the same
  // ground the neutron-rich chains do and cannot claim a nucleus is finished
  // decaying while the other table is still counting it down.
  const STABLE_KEYS = (
    '1002 2003 2004 3006 3007 4009 5010 5011 6012 6013 ' +
    '7014 7015 8016 8017 8018 9019 10020 10021 10022 11023 ' +
    '12024 12025 12026 13027 14028 14029 14030 15031 16032 16033 ' +
    '16034 16036 17035 17037 18036 18038 18040 19039 19041 20040 ' +
    '20042 20043 20044 20046 21045 22046 22047 22048 22049 22050 ' +
    '23051 24052 24053 24054 25055 26054 26056 26057 26058 27059 ' +
    '28058 28060 28061 28062 28064 29063 29065 30064 30066 30067 ' +
    '30068 31069 31071 32070 32072 32073 32074 32076 33075 34074 ' +
    '34076 34077 34078 34080 35079 35081 36078 36080 36082 36083 ' +
    '36084 36086 37085 38084 38086 38087 38088 39089 40090 40091 ' +
    '40092 40094 41093 42092 42094 42095 42096 42097 42098 44096 ' +
    '44098 44099 44100 44101 44102 44104 45103 46102 46104 46105 ' +
    '46106 46108 46110 47107 47109 48106 48108 48110 48111 48112 ' +
    '48114 49113 50112 50114 50115 50116 50117 50118 50119 50120 ' +
    '50122 50124 51121 51123 52120 52122 52124 52125 52126 53127 ' +
    '54126 54128 54129 54130 54131 54132 55133 56130 56134 56135 ' +
    '56136 56137 56138 57139 58136 58140 59141 60142 60143 60145 ' +
    '60146 60148 62144 62149 62150 62152 62154 63153 64154 64155 ' +
    '64156 64157 64158 64160 65159 66156 66158 66160 66161 66162 ' +
    '66163 66164 67165 68162 68164 68166 68167 68168 68170 69169 ' +
    '70168 70170 70171 70172 70173 70174 70176 71175 72176 72177 ' +
    '72178 72179 72180 73181 74182 74184 74186 75185 76187 76188 ' +
    '76189 76190 76192 77191 77193 78192 78194 78195 78196 78198 ' +
    '79197 80196 80198 80199 80200 80201 80202 80204 81203 81205 ' +
    '82206 82207 82208'
  ).split(' ');
  const STABLE = /* @__PURE__ */ new Set();
  for (const k of STABLE_KEYS) {
    const n = Number(k);
    if (n > 0) STABLE.add(n);
  }

  // The nuclides the same dump measures as electron capture and nothing else.
  // They are deliberately not decay rows here: an electron falling into the
  // nucleus is not a positron flying out of it, and this table speaks about
  // positron emission. They are kept for one honest reason - a positron chain
  // that comes to rest on one of them has stopped short of stability, and
  // pathTo has to be able to say so instead of printing a truncated chain
  // under the heading 'path to stability'. 96 nuclides at or below lead.
  const EC_KEYS = (
    '4007 11020 18031 18037 20041 22044 23049 24051 25053 26055 ' +
    '27057 31067 32068 32071 33073 34066 34072 34075 36081 37083 ' +
    '38082 38085 40088 42093 43090 43097 44094 45101 46100 46103 ' +
    '47097 48097 48109 49111 50110 51119 52118 52123 53125 54122 ' +
    '54127 55131 56128 56133 57128 57137 58134 58139 60140 61128 ' +
    '61145 61146 62145 63147 63149 64151 64153 65155 65157 66159 ' +
    '67161 67163 68158 68160 68165 69167 70164 70166 70169 71173 ' +
    '72170 72172 72175 73179 73180 74157 74176 74178 74181 75183 ' +
    '76174 76182 76185 77174 77189 78191 78193 79195 80192 80194 ' +
    '80197 81201 82200 82202 82203 82205'
  ).split(' ');
  const EC_ONLY = /* @__PURE__ */ new Set();
  for (const k of EC_KEYS) {
    const n = Number(k);
    if (n > 0) EC_ONLY.add(n);
  }

  // The heaviest proton number this table speaks for - the same line the engine
  // draws, and the same line the beta-minus table draws.
  const MAX_Z = 82;

  function info(z, a) {
    return TABLE.get(z * 1000 + a) || null;
  }
  function isPositronRadioactive(z, a) {
    return TABLE.has(z * 1000 + a);
  }
  function isTabulatedStable(z, a) {
    return STABLE.has(z * 1000 + a);
  }
  function isElectronCaptureOnly(z, a) {
    return EC_ONLY.has(z * 1000 + a);
  }
  // The nucleus a positron leaves behind: one proton fewer, one neutron more, the
  // mass number untouched - except on the beta-delayed-proton rows, which lose
  // two protons and one mass number because the nucleus throws a proton after the
  // positron rather than settling for nitrogen-13 or cadmium-99.
  function daughterOf(z, a) {
    const hit = TABLE.get(z * 1000 + a);
    if (!hit) return null;
    const shed = hit.m === 1 ? 1 : 0;
    const dz = z - 1 - shed;
    const da = a - shed;
    if (!(dz >= 1) || !(da > dz)) return null;
    return { z: dz, a: da, halfLife: hit.t, mode: hit.m, protonsShed: shed };
  }
  // The whole path to stability at a glance, the way the physicist writes it:
  // daughter after daughter until the charts have nothing left to say. Every step
  // keeps the mass number and drops one proton, so a chain marches down the one
  // isobar it started on and comes to rest on the stable isobar of that mass - it
  // walks toward stability rather than past it, so it never lands on the
  // neutron-rich side and never needs the other table's help. Which makes the
  // reasons it can stop mostly tripwires, and they are there to be honest rather
  // than quiet: 'handedOver' means the two tables speak about the same nucleus,
  // which does not happen in the dump and must never be papered over if it ever
  // did, and 'unlisted' means the chain came to rest on a nuclide the dump
  // measures as something else - the pure electron-capture gap this file admits to
  // at the top of it.
  function pathTo(z, a, limit) {
    const steps = [];
    const cap = limit || 12;
    const other = window.__mol3dBeta;
    let cz = z, ca = a, reason = 'stable';
    for (let i = 0; i < cap; i++) {
      const d = daughterOf(cz, ca);
      if (!d) {
        if (other && other.daughterOf && other.daughterOf(cz, ca)) { reason = 'handedOver'; break; }
        if (cz > MAX_Z) reason = 'protonChain';
        else if (isTabulatedStable(cz, ca)) reason = 'stable';
        else if (info(cz, ca)) reason = 'otherMode';
        else if (isElectronCaptureOnly(cz, ca)) reason = 'electronCapture';
        else reason = 'unlisted';
        break;
      }
      steps.push({ from: { z: cz, a: ca }, to: { z: d.z, a: d.a }, halfLife: d.halfLife, mode: d.mode, protonsShed: d.protonsShed });
      cz = d.z;
      ca = d.a;
    }
    if (steps.length === cap) reason = 'capped';
    return { steps: steps, endZ: cz, endA: ca, reason: reason };
  }

  // Half-lives here span from 103 ns (rubidium-72) to 2.7e17 years (vanadium-50),
  // thirty-two orders of magnitude, so the unit has to travel
  // with the number. Nothing is ever rounded down to a zero: a lifetime too short
  // to name in seconds gets named in nanoseconds, and one too long for years gets
  // scientific years. Same ruler the beta-minus table uses, so the two never
  // describe the same span in different words.
  function formatLife(t) {
    if (!isFinite(t) || !(t > 0)) return 'not measured';
    if (t < 1e-6) return (t * 1e9).toPrecision(3) + ' ns';
    if (t < 1e-3) return (t * 1e6).toPrecision(3) + ' us';
    if (t < 1) return (t * 1e3).toPrecision(3) + ' ms';
    if (t < 90) return t.toPrecision(4) + ' s';
    if (t < 5400) return (t / 60).toPrecision(4) + ' min';
    if (t < 172800) return (t / 3600).toPrecision(4) + ' h';
    if (t < 2.592e6) return (t / 86400).toPrecision(4) + ' d';
    const y = t / 3.15576e7;
    if (y < 1e3) return y.toPrecision(4) + ' y';
    if (y < 1e6) return (y / 1e3).toPrecision(4) + ' kyr';
    if (y < 1e9) return (y / 1e6).toPrecision(4) + ' Myr';
    if (y < 1e12) return (y / 1e9).toPrecision(4) + ' Gyr';
    return y.toExponential(2) + ' y';
  }

  window.__mol3dBetaPlus = {
    info: info,
    isPositronRadioactive: isPositronRadioactive,
    isTabulatedStable: isTabulatedStable,
    isElectronCaptureOnly: isElectronCaptureOnly,
    daughterOf: daughterOf,
    pathTo: pathTo,
    formatLife: formatLife,
    count: function () { return TABLE.size; },
    MAX_Z: MAX_Z,
    SOURCE: 'IAEA live chart of nuclides, via the Orciument/nuclide-data dump (Feb 2023)'
  };
})();
