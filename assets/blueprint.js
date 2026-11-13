/* BLUEPRINT — an in-game 2D structural editor (MolView-style Lewis drawing) that
   exports straight into the live 3D scene.
   Ported from the editor that lived in the stale src/main.js mirror (last seen in
   c5efb17, deleted in 89529c1) and rewritten as a self-contained asset in the
   house style of pool-drag.js: one IIFE, its own injected <style>, its own DOM and
   a small window API. Nothing here duplicates the game: bond legality, geometry and
   analysis all go back through window.__mol3d and window.Mol3DPhysics. */
(function () {
  'use strict';

  if (window.__mol3dBlueprintMounted) return;
  window.__mol3dBlueprintMounted = true;

  var STYLE_ID = 'mol3d-blueprint-styles';
  var SAVE_KEY = 'mol3d.blueprint.v1';
  var GRID = 40;              // world pixels per grid cell
  var BOND_LEN = 2 * GRID;    // the length a clean layout aims for
  var HISTORY_MAX = 200;
  var ANG_PER_PX = 0.032;     // one grid cell = 1.28 A in the exported MOL block

  // ==========================================================================
  // 1. Strings. Vietnamese is the language of the game, so it is the default;
  //    every visible string is looked up through tx().
  // ==========================================================================
  var STR = {
    en: {
      menuBtn: 'Blueprint: 2D structure editor',
      title: '2D Structure Blueprint',
      close: 'Close',
      minimize: 'Collapse the panel',
      expand: 'Expand the panel',
      help: 'Help and shortcuts',
      tSelect: 'Select / move — drag an empty area for a box select',
      tAtom: 'Place atom — every click drops the chosen element',
      tBond: 'Bond — drag atom to atom; click an existing bond to LOWER its order',
      tChargeP: 'Formal charge +1 — click an atom',
      tChargeM: 'Formal charge -1 — click an atom',
      tLpP: 'Add a lone pair — click an atom',
      tLpM: 'Remove a lone pair — click an atom',
      tBracket: 'Ion / coordination brackets — brackets the selection, or the whole molecule',
      tErase: 'Erase — click an atom or a bond to delete it',
      tPan: 'Pan — drag the canvas; hold Space with any other tool',
      bond1: 'New bonds are single',
      bond2: 'New bonds are double',
      bond3: 'New bonds are triple',
      undo: 'Undo (Ctrl+Z)',
      redo: 'Redo (Ctrl+Y)',
      copy: 'Copy selection (Ctrl+C)',
      cut: 'Cut selection (Ctrl+X)',
      paste: 'Paste (Ctrl+V)',
      selectAll: 'Select everything (Ctrl+A)',
      del: 'Delete selection (Del)',
      addH: 'Fill every open valence with hydrogen',
      clean: 'Clean layout — standard bond angles and lengths',
      fit: 'Fit the molecule to the view',
      zin: 'Zoom in',
      zout: 'Zoom out',
      grid: 'Grid and snap',
      hydrogens: 'Show hydrogen atoms',
      charges: 'Show formal charges',
      lp: 'Show lone pairs',
      shells: 'Bohr shells on the atoms',
      to3d: 'Build in the 3D scene',
      png: 'Export PNG image',
      mol: 'Export MOL block',
      smiles: 'Export SMILES',
      helpBtn: 'Help',
      closeBtn: 'Close',
      element: 'Element',
      elSearchPh: 'Search all 118 elements…',
      formulaLbl: 'Formula',
      netLbl: 'Net charge',
      countsLbl: 'Atoms / bonds',
      noSel: 'Nothing selected',
      selN: '{n} atoms selected',
      placed: 'Placed {sym}',
      unknownEl: 'Unknown element "{sym}"',
      bondMade: 'Bond {a}{o}{b}',
      bondIonic: '{a} hands an electron to {b} — joined as an ionic bond',
      bondNoRaise: 'That bond cannot carry any more',
      bondLower: 'Bond lowered to order {n}',
      bondCut: 'Bond removed',
      wouldMerge: 'Those two atoms are already connected — drawing a bond there would fuse the two fragments',
      ringClosed: 'ring closed',
      chargeSet: '{sym} formal charge {q}',
      lpSet: '{sym} lone pairs: {n}',
      lpNone: 'That atom has no lone pair to remove',
      erasedAtom: 'Erased {sym}',
      erasedBonds: '{n} bonds removed with it',
      deleted: '{n} atoms deleted',
      bracketAdd: 'Bracket group of {n} atoms',
      bracketDel: 'Bracket group removed',
      undoDone: 'Undo',
      redoDone: 'Redo',
      nothingUndo: 'Nothing to undo',
      nothingRedo: 'Nothing to redo',
      copied: '{n} atoms copied',
      pasted: 'Pasted {n} atoms',
      pasteSkipped: '{n} copied bonds were refused by the rules',
      nothingPaste: 'Clipboard is empty — copy something first',
      nothingSel: 'Select atoms first',
      hAdded: '{n} hydrogens added',
      hNone: 'Every valence is already satisfied',
      hBlocked: '{n} hydrogens skipped: the atoms with an open valence are not bonded to anything yet',
      hRefused: '{n} hydrogens refused by the rules',
      laidOut: 'Layout cleaned',
      cleared: 'Canvas cleared',
      emptyDoc: 'The canvas is empty — place some atoms first',
      needGame: 'The 3D scene is not loaded yet',
      exportFail: '{n} bond(s) the scene rejected were skipped',
      exported: 'Blueprint built in the 3D scene: {list}',
      exportBroken: 'Nothing could be built: {reason}',
      pngDone: 'PNG saved',
      molHead: 'MOL block — copy or save it',
      smilesHead: 'SMILES — copy or save it',
      copyText: 'Copy text',
      textCopied: 'Copied to the clipboard',
      copyFailed: 'The browser refused the clipboard — select the text and copy it by hand',
      saveAs: 'Download',
      download: 'Download {name}',
      zoomLbl: 'Zoom',
      helpTitle: 'Blueprint — how it works',
      tooBig: '{n} atoms is past the {max}-atom limit of one molecule',
      notConnected: 'Heads up: the drawing has {n} separate fragments; the 3D export builds each one as its own molecule',
      langNote: 'Language',
      fragment: 'fragment',
      fragments: 'fragments',
      ringNote: 'rings detected',
      badBonds: 'bonds the rules refuse',
      emptyFormula: '—',
      radLabel: 'C',
      presetWater: 'Water H2O',
      presetBenzene: 'Benzene C6H6',
      presetEthanol: 'Ethanol C2H5OH',
      presetCyclohexane: 'Cyclohexane C6H12',
      presetNitrate: 'Nitrate NO3-',
      loadedPreset: 'Loaded {name} into the editor',
      presetRepaired: '{n} bonds did not fit the rules and were corrected',
      presetRepairedOne: '1 bond did not fit the rules and was corrected',
      saveRepaired: '{n} bonds from the saved board did not fit the rules and were corrected',
      saveRepairedOne: '1 bond from the saved board did not fit the rules and was corrected',
      loadFailed: 'Not a molecule state — expected {atoms:[...], bonds:[...]}',
      stateLoaded: 'Loaded {a} and {b}',
      oneAtom: '1 atom', manyAtoms: '{n} atoms',
      oneBond: '1 bond', manyBonds: '{n} bonds',
      sVsepr: 'VSEPR',
      vsepr: 'Auto-VSEPR — atoms land on the joints the electron domains allow',
      placedJoint: '{sym} dropped onto a free joint of {a}',
      jointLp: ' from the lone pair of {a}',
      jointNone: 'No free joint left on {a}: every position its rules allow is taken',
      altFreeNote: 'Hold Alt to drop an atom off the joints',
      dragRigid: '{n} atoms moved as one piece',
      dockedJoint: 'Docked onto the joint of {a} — the bond tool joins them',
      geometryOn: 'Auto-VSEPR on — new atoms snap to the joints',
      geometryOff: 'Auto-VSEPR off — free placement',
      nothingErase: 'Nothing there to erase',
      bondOrderSet: 'New bond order: {n}',
      snapOn: 'Snap grid on',
      snapOff: 'Snap grid off',
      menuRaise: 'Raise the bond order',
      menuLower: 'Lower the bond order',
      menuDeleteBond: 'Delete this bond',
      menuErase: 'Erase this',
      menuBracket: 'Bracket this group',
      menuLpAdd: 'Add a lone pair',
      menuLpRemove: 'Remove a lone pair',
      menuPasteHere: 'Paste here',
      menuClear: 'Clear the canvas',
      menuApplySel: 'Apply to the {n} selected atoms',
      helpSecTools: 'Tools',
      helpSecActions: 'Actions',
      helpSecKeys: 'Keyboard',
      helpSecExport: 'Export',
      helpSecPresets: 'Quick build — right-click an empty spot on the canvas',
      helpSecGeometry: 'Geometry — automatic VSEPR',
      geomNote: 'Bond lengths come from the game engine\'s own ball-to-ball measure, and directions from the electron domains around each centre: 2 domains 180°, 3 domains 120°, 4 domains the 90° cross of a structural formula, 5 a pentagon, 6 a hexagon. Lone pairs count as domains too, so water is bent at 105°, ammonia keeps 107°/107°/146° and xenon difluoride stays linear. Atoms never land where the mouse stopped: each one drops onto the free joint nearest the pointer, and a centre that is still allowed to grow is shown the joints of the arrangement it is heading for, so the fifth and sixth fluorine of sulfur hexafluoride belong to sulfur rather than to the fluorine beside them. Joints on the skeleton are offered before joints on its ends, and a joint the rules close is refused with the reason shown. After every drop only the piece just edited settles, and it settles around the atom it was built from, so nothing already placed moves. A click that lands on an atom already carrying the element in the tool asks for one more atom on that spot, so it takes the nearest free joint of a neighbouring centre — the direction the structure is heading for — instead of only selecting the atom; a click in the middle of an atom never grows that same atom, because a click on its centre carries no direction. A click on an atom carrying a different element paints that element and re-asks every bond left behind, correcting any line the new atom cannot hold and naming the rule that refused it. Hold Alt to place off the joints; the Auto-VSEPR switch turns the model off and drawing becomes free grid placement.',
      helpExportNote: 'Build 3D hands the drawing to the game engine: the atoms are spawned in free space near the camera target, every bond goes through the game bond rules, and the engine then rebuilds the real 3D geometry from the connectivity, so rings come out as real rings. The scene derives lone pairs and charges from the structure itself, so the export carries the connectivity, the bond orders and the molecular charge. PNG keeps the drawing exactly as it looks, the MOL block keeps the 2D coordinates, SMILES keeps connectivity, bond orders and charges.',
      kUndo: 'Undo / redo',
      kClip: 'Copy / cut / paste the selection',
      kAll: 'Select everything',
      kDel: 'Delete the selection',
      kToolKeys: 'Tools: select, atom, bond, erase, pan',
      kOrderKeys: 'Bond order for the next bond',
      kFitKey: 'Fit the molecule to the view',
      kGridKey: 'Grid and snap together',
      kSnapKey: 'Snap on / off only',
      kHKey: 'Show / hide hydrogens',
      kZoomKeys: 'Zoom in / out, then fit',
      kNudgeKeys: 'Nudge the selection; with nothing selected it pans the view',
      kSpaceKey: 'Space (or the wheel) pans, Ctrl + wheel zooms',
      kChargeKeys: 'Formal charge +1 / −1 on the selection',
      kLpKeys: 'Lone pair add / remove on the selection',
      kAltKey: 'Hold while placing or dragging to ignore the joints',
      kEscKey: 'Close popups, then the selection, then the panel',
      exportNoRoom: 'The scene is full — {n} atom(s) could not be placed',
      exportNeedStars: 'This drawing costs ⭐{n} in atoms — buy the elements first',
      exportRejected: 'The scene rejected {n} bond(s): {list}',
      exportLowered: '{n} bond(s) kept a lower order in the scene: {list}',
      exportedList: '{n} atoms, {b} bonds'
    },
    vi: {
      menuBtn: 'Bản vẽ cấu tạo: trình vẽ 2D',
      title: 'Bản vẽ cấu tạo 2D',
      close: 'Đóng',
      minimize: 'Thu gọn bảng',
      expand: 'Mở rộng bảng',
      help: 'Trợ giúp và phím tắt',
      tSelect: 'Chọn / di chuyển — kéo lên vùng trống để chọn bằng khung',
      tAtom: 'Đặt nguyên tử — mỗi lần bấm sẽ thả nguyên tố đang chọn',
      tBond: 'Liên kết — kéo từ nguyên tử này sang nguyên tử khác; bấm vào liên kết có sẵn để GIẢM bậc',
      tChargeP: 'Điện tích hình thức +1 — bấm vào nguyên tử',
      tChargeM: 'Điện tích hình thức −1 — bấm vào nguyên tử',
      tLpP: 'Thêm cặp electron tự do — bấm vào nguyên tử',
      tLpM: 'Bớt cặp electron tự do — bấm vào nguyên tử',
      tBracket: 'Dấu ngoặc ion / phối trí — đóng ngoặc phần đang chọn, hoặc cả phân tử',
      tErase: 'Tẩy — bấm vào nguyên tử hoặc liên kết để xoá',
      tPan: 'Di chuyển trang — kéo trên canvas; giữ Space với mọi công cụ khác',
      bond1: 'Liên kết mới là liên kết đơn',
      bond2: 'Liên kết mới là liên kết đôi',
      bond3: 'Liên kết mới là liên kết ba',
      undo: 'Hoàn tác (Ctrl+Z)',
      redo: 'Làm lại (Ctrl+Y)',
      copy: 'Sao chép phần chọn (Ctrl+C)',
      cut: 'Cắt phần chọn (Ctrl+X)',
      paste: 'Dán (Ctrl+V)',
      selectAll: 'Chọn tất cả (Ctrl+A)',
      del: 'Xoá phần đang chọn (Del)',
      addH: 'Lấp mọi hoá trị còn trống bằng hydro',
      clean: 'Dọn layout — góc và độ dài liên kết chuẩn',
      fit: 'Vừa khung hình với phân tử',
      zin: 'Phóng to',
      zout: 'Thu nhỏ',
      grid: 'Lưới và dính lưới',
      hydrogens: 'Hiện nguyên tử hydro',
      charges: 'Hiện điện tích hình thức',
      lp: 'Hiện cặp electron tự do',
      shells: 'Lớp electron Bohr trên nguyên tử',
      to3d: 'Dựng vào cảnh 3D',
      png: 'Xuất ảnh PNG',
      mol: 'Xuất khối MOL',
      smiles: 'Xuất SMILES',
      helpBtn: 'Trợ giúp',
      closeBtn: 'Đóng',
      element: 'Nguyên tố',
      elSearchPh: 'Tìm trong 118 nguyên tố…',
      formulaLbl: 'Công thức',
      netLbl: 'Điện tích ròng',
      countsLbl: 'Nguyên tử / liên kết',
      noSel: 'Chưa chọn gì',
      selN: 'Đã chọn {n} nguyên tử',
      placed: 'Đã đặt {sym}',
      unknownEl: 'Không rõ nguyên tố "{sym}"',
      bondMade: 'Liên kết {a}{o}{b}',
      bondIonic: '{a} nhường electron cho {b} — nối bằng liên kết ion',
      bondNoRaise: 'Liên kết này không mang thêm được nữa',
      bondLower: 'Hạ liên kết xuống bậc {n}',
      bondCut: 'Đã cắt liên kết',
      wouldMerge: 'Hai nguyên tử này đã nối với nhau — vẽ liên kết ở đó sẽ gộp hai phân tử làm một',
      ringClosed: 'đã khép vòng',
      chargeSet: 'Điện tích hình thức của {sym} là {q}',
      lpSet: '{sym} có {n} cặp electron tự do',
      lpNone: 'Nguyên tử đó không còn cặp electron tự do nào để bớt',
      erasedAtom: 'Đã tẩy {sym}',
      erasedBonds: 'kèm {n} liên kết',
      deleted: 'Đã xoá {n} nguyên tử',
      bracketAdd: 'Nhóm trong ngoặc gồm {n} nguyên tử',
      bracketDel: 'Đã bỏ nhóm trong ngoặc',
      undoDone: 'Đã hoàn tác',
      redoDone: 'Đã làm lại',
      nothingUndo: 'Không còn gì để hoàn tác',
      nothingRedo: 'Không còn gì để làm lại',
      copied: 'Đã sao chép {n} nguyên tử',
      pasted: 'Đã dán {n} nguyên tử',
      pasteSkipped: 'Quy tắc đã từ chối {n} liên kết được dán',
      nothingPaste: 'Bộ nhớ tạm trống — hãy sao chép trước',
      nothingSel: 'Hãy chọn nguyên tử trước',
      hAdded: 'Đã thêm {n} nguyên tử hydro',
      hNone: 'Mọi hoá trị đều đã được lấp đầy',
      hBlocked: 'Bỏ qua {n} hydro: các nguyên tử còn hoá trị trống chưa liên kết với gì',
      hRefused: 'Quy tắc đã từ chối {n} hydro',
      laidOut: 'Đã dọn layout',
      cleared: 'Đã xoá sạch canvas',
      emptyDoc: 'Canvas đang trống — hãy đặt vài nguyên tử trước',
      needGame: 'Cảnh 3D chưa sẵn sàng',
      exportFail: 'Đã bỏ qua {n} liên kết bị cảnh 3D từ chối',
      exported: 'Đã dựng bản vẽ vào cảnh 3D: {list}',
      exportBroken: 'Không dựng được: {reason}',
      pngDone: 'Đã lưu PNG',
      molHead: 'Khối MOL — sao chép hoặc lưu',
      smilesHead: 'SMILES — sao chép hoặc lưu',
      copyText: 'Sao chép văn bản',
      textCopied: 'Đã sao chép vào bộ nhớ tạm',
      copyFailed: 'Trình duyệt chặn bộ nhớ tạm — hãy bôi đen văn bản rồi tự sao chép',
      saveAs: 'Tải xuống',
      download: 'Tải xuống {name}',
      zoomLbl: 'Thu phóng',
      helpTitle: 'Bản vẽ cấu tạo — cách dùng',
      tooBig: '{n} nguyên tử đã vượt giới hạn {max} nguyên tử của một phân tử',
      notConnected: 'Lưu ý: bản vẽ có {n} mảnh rời; khi xuất mỗi mảnh sẽ thành một phân tử riêng',
      langNote: 'Ngôn ngữ',
      fragment: 'mảnh',
      fragments: 'mảnh',
      ringNote: 'vòng đã phát hiện',
      badBonds: 'liên kết quy tắc bác bỏ',
      emptyFormula: '—',
      radLabel: 'C',
      presetWater: 'Nước H2O',
      presetBenzene: 'Benzen C6H6',
      presetEthanol: 'Ethanol C2H5OH',
      presetCyclohexane: 'Xiclohexan C6H12',
      presetNitrate: 'Nitrat NO3-',
      loadedPreset: 'Đã nạp {name} vào trình vẽ',
      presetRepaired: '{n} liên kết không hợp quy tắc và đã bị sửa',
      presetRepairedOne: '1 liên kết không hợp quy tắc và đã bị sửa',
      saveRepaired: '{n} liên kết trong bảng đã lưu không hợp quy tắc và đã bị sửa',
      saveRepairedOne: '1 liên kết trong bảng đã lưu không hợp quy tắc và đã bị sửa',
      loadFailed: 'Không phải trạng thái phân tử — cần {atoms:[...], bonds:[...]}',
      stateLoaded: 'Đã nạp {a} và {b}',
      oneAtom: '1 nguyên tử', manyAtoms: '{n} nguyên tử',
      oneBond: '1 liên kết', manyBonds: '{n} liên kết',
      sVsepr: 'VSEPR',
      vsepr: 'Tự động VSEPR — nguyên tử đáp vào khớp mà các vùng electron cho phép',
      placedJoint: 'Đã đặt {sym} vào khớp trống của {a}',
      jointLp: ' từ cặp electron tự do của {a}',
      jointNone: 'Không còn khớp trống trên {a}: mọi vị trí hợp lệ đều đã bị chiếm',
      altFreeNote: 'Giữ Alt để đặt nguyên tử ngoài các khớp',
      dragRigid: 'Đã di chuyển {n} nguyên tử như một khối',
      dockedJoint: 'Đã áp vào khớp của {a} — dùng công cụ liên kết để nối chúng',
      geometryOn: 'Bật VSEPR — nguyên tử mới bám vào khớp',
      geometryOff: 'Tắt VSEPR — đặt tự do',
      nothingErase: 'Không có gì để tẩy ở đó',
      bondOrderSet: 'Bậc liên kết mới: {n}',
      snapOn: 'Đã bật dính lưới',
      snapOff: 'Đã tắt dính lưới',
      menuRaise: 'Tăng bậc liên kết',
      menuLower: 'Hạ bậc liên kết',
      menuDeleteBond: 'Xoá liên kết này',
      menuErase: 'Tẩy phần này',
      menuBracket: 'Đóng ngoặc nhóm này',
      menuLpAdd: 'Thêm cặp electron tự do',
      menuLpRemove: 'Bớt cặp electron tự do',
      menuPasteHere: 'Dán tại đây',
      menuClear: 'Xoá sạch canvas',
      menuApplySel: 'Áp dụng cho {n} nguyên tử đang chọn',
      helpSecTools: 'Công cụ',
      helpSecActions: 'Thao tác',
      helpSecKeys: 'Phím tắt',
      helpSecExport: 'Xuất',
      helpSecPresets: 'Dựng nhanh — nhấp chuột phải vào vùng trống trên Canvas',
      helpSecGeometry: 'Hình học — VSEPR tự động',
      geomNote: 'Độ dài liên kết lấy từ thước đo giữa hai quả cầu của engine trò chơi, còn hướng lấy từ các vùng electron quanh mỗi nguyên tử trung tâm: 2 vùng 180°, 3 vùng 120°, 4 vùng là hình chữ thập 90° của công thức cấu tạo, 5 vùng hình ngũ giác, 6 vùng hình lục giác. Cặp electron tự do cũng được tính là một vùng, nên nước gấp khúc 105°, amoniac giữ 107°/107°/146° và xenon điflorua vẫn thẳng hàng. Nguyên tử không đáp vào nơi con trỏ dừng lại: mỗi nguyên tử đáp vào khớp trống gần con trỏ nhất, và một tâm còn được phép mở rộng sẽ hiện các khớp của cấu hình mà nó đang hướng tới, nên flo thứ năm và thứ sáu của sulfur hexafluorua thuộc về sulfur chứ không thuộc về nguyên tử flo bên cạnh. Khớp trên khung xương được ưu tiên trước khớp ở đầu mạch, còn khớp bị quy tắc đóng lại thì bị từ chối kèm theo lý do. Sau mỗi lần đặt, chỉ phần vừa sửa mới tự cân bằng, và nó cân bằng quanh nguyên tử vừa được xây, nên những gì đã đặt không bị xê dịch. Một cú click rơi trên nguyên tử đã mang chính nguyên tố đang chọn được hiểu là đòi thêm một nguyên tử ngay chỗ đó, nên nó đáp vào khớp trống gần nhất của một tâm láng giềng — hướng mà cấu trúc đang tiến tới — thay vì chỉ chọn nguyên tử; một cú click vào giữa một nguyên tử không bao giờ làm chính nguyên tử đó lớn thêm, vì click vào tâm thì không mang theo hướng nào. Một cú click trên nguyên tử mang nguyên tố khác sẽ sơn nguyên tố mới và hỏi lại mọi liên kết còn lại, chỉnh lại liên kết mà nguyên tử mới không gánh nổi và nêu tên quy tắc đã từ chối nó. Giữ Alt để đặt ngoài khớp; công tắc Auto-VSEPR tắt mô hình và việc vẽ trở thành đặt tự do theo lưới.',
      helpExportNote: 'Nút Dựng 3D giao bản vẽ cho engine của trò chơi: nguyên tử được thả vào khoảng trống gần tâm quay của camera, mỗi liên kết đi qua luật liên kết của trò chơi, rồi engine dựng lại hình học 3D thật từ kết nối — vì vậy vòng được tạo thành vòng đúng. Cảnh tự suy ra electron tự do và điện tích, nên bản xuất mang kết nối, bậc liên kết và điện tích phân tử. PNG giữ đúng hình đang vẽ, khối MOL giữ toạ độ 2D, SMILES giữ kết nối, bậc liên kết và điện tích.',
      kUndo: 'Hoàn tác / làm lại',
      kClip: 'Sao chép / cắt / dán phần chọn',
      kAll: 'Chọn tất cả',
      kDel: 'Xoá phần đang chọn',
      kToolKeys: 'Đổi công cụ: chọn, nguyên tử, liên kết, tẩy, kéo',
      kOrderKeys: 'Bậc cho liên kết kế tiếp',
      kFitKey: 'Vừa khung hình với phân tử',
      kGridKey: 'Bật/tắt lưới kèm dính lưới',
      kSnapKey: 'Chỉ bật/tắt dính lưới',
      kHKey: 'Hiện/ẩn nguyên tử hydro',
      kZoomKeys: 'Phóng to / thu nhỏ / về mặc định',
      kNudgeKeys: 'Tinh chỉnh phần đang chọn; nếu chưa chọn gì sẽ kéo trang',
      kSpaceKey: 'Space (hoặc con lăn) để kéo trang, Ctrl + con lăn để phóng',
      kChargeKeys: 'Điện tích hình thức +1 / −1 cho phần đang chọn',
      kLpKeys: 'Thêm / bớt cặp electron tự do cho phần đang chọn',
      kAltKey: 'Giữ khi đặt hoặc kéo nguyên tử để bỏ qua các khớp',
      kEscKey: 'Đóng hộp nổi, rồi bỏ chọn, rồi đóng bảng',
      exportNoRoom: 'Cảnh đã đầy — không đặt được {n} nguyên tử',
      exportNeedStars: 'Bản vẽ này tốn ⭐{n} nguyên tử — hãy mua nguyên tố trước',
      exportRejected: 'Cảnh từ chối {n} liên kết: {list}',
      exportLowered: '{n} liên kết giữ bậc thấp hơn trong cảnh: {list}',
      exportedList: '{n} nguyên tử, {b} liên kết'
    }
  };

  function app() { return window.__mol3d || null; }
  function langNow() {
    var a = app();
    if (a && a.i18n && typeof a.i18n.getLang === 'function') {
      try { var l = a.i18n.getLang(); if (l === 'vi' || l === 'en') return l; } catch (e) {}
    }
    var d = document.documentElement.lang;
    return d === 'en' ? 'en' : 'vi';
  }
  function tx(key, params) {
    var l = langNow();
    var s = (STR[l] && STR[l][key]) || STR.en[key] || key;
    if (params) {
      for (var k in params) {
        if (Object.prototype.hasOwnProperty.call(params, k)) {
          s = s.split('{' + k + '}').join(String(params[k]));
        }
      }
    }
    return s;
  }
  // A count and its noun, agreed in the language being shown. English marks the
  // single; Vietnamese carries the number either way.
  function counted(n, one, many) { return tx(n === 1 ? one : many, { n: n }); }
  // "1 bond was corrected" / "3 bonds were corrected": the count is the subject of
  // these sentences, so the verb has to agree with it.
  function repairedNote(oneKey, manyKey, n) { return tx(n === 1 ? oneKey : manyKey, { n: n }); }
  function toast(msg, kind) {
    var a = app();
    if (a && typeof a.status === 'function') { try { a.status(msg, kind || 'info'); return; } catch (e) {} }
    if (kind === 'err') { try { console.warn('blueprint: ' + msg); } catch (e) {} }
  }

  // ==========================================================================
  // 2. Element data.
  //    The colour of a symbol comes from the game's own CPK-ish table so the
  //    drawing matches the scene. The few letters a chemist reads by colour in a
  //    structural formula (H green, O red, N blue, …) follow the reference layout
  //    the drawing is judged against; the game table then covers every one of the
  //    118 elements, so nothing falls back to a bare white letter.
  // ==========================================================================
  var INK = {
    H: '#3fb950', D: '#3fb950', T: '#3fb950', C: '#d7e3f4', N: '#58a6ff', O: '#ff4d4d',
    S: '#f2c744', P: '#ff9640', B: '#ffb5b5', Si: '#8fd6c2', Se: '#ffd07a', Te: '#ffc97a',
    As: '#e0a4ff', Sb: '#e0a4ff', Bi: '#e0a4ff',
    F: '#7ee787', Cl: '#7ee787', Br: '#d98c5f', I: '#c792ea', At: '#95a3b8', Ts: '#95a3b8',
    Li: '#cc80ff', Na: '#cc80ff', K: '#cc80ff', Rb: '#ff80bf', Cs: '#a060ff', Fr: '#a060ff',
    Be: '#c2ff00', Mg: '#c2ff00', Ca: '#3ddb3d', Sr: '#00ff00', Ba: '#00c000', Ra: '#007d00'
  };
  var CAT_INK = {
    alkali: '#cc80ff', alkaline: '#c2ff00', transition: '#d2a8ff', post: '#79c0ff',
    metalloid: '#56d364', nonmetal: '#3fb950', halogen: '#a5d6ff', noble: '#bc8cff',
    lanthanide: '#f0883e', actinide: '#db6d28', unknown: '#8b949e'
  };
  // Symbol order is the atomic-number order, so the editor still knows all 118
  // elements if the registry has not been created yet.
  var SYMS = ('H,He,Li,Be,B,C,N,O,F,Ne,Na,Mg,Al,Si,P,S,Cl,Ar,K,Ca,Sc,Ti,V,Cr,Mn,Fe,Co,Ni,Cu,Zn,' +
    'Ga,Ge,As,Se,Br,Kr,Rb,Sr,Y,Zr,Nb,Mo,Tc,Ru,Rh,Pd,Ag,Cd,In,Sn,Sb,Te,I,Xe,Cs,Ba,La,Ce,Pr,Nd,Pm,' +
    'Sm,Eu,Gd,Tb,Dy,Ho,Er,Tm,Yb,Lu,Hf,Ta,W,Re,Os,Ir,Pt,Au,Hg,Tl,Pb,Bi,Po,At,Rn,Fr,Ra,Ac,Th,Pa,U,' +
    'Np,Pu,Am,Cm,Bk,Cf,Es,Fm,Md,No,Lr,Rf,Db,Sg,Bh,Hs,Mt,Ds,Rg,Cn,Nh,Fl,Mc,Lv,Ts,Og').split(',');
  // Standard valence used when filling open valences with hydrogen. Anything not
  // listed falls back to the game's own data (charges / anionCharge / maxBonds).
  var STD_V = {
    H: 1, D: 1, T: 1, Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Fr: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Ra: 2,
    B: 3, Al: 3, Ga: 3, In: 3, Tl: 3, C: 4, Si: 4, Ge: 4, Sn: 4, Pb: 4, N: 3, P: 3, As: 3, Sb: 3, Bi: 3,
    O: 2, S: 2, Se: 2, Te: 2, Po: 2, F: 1, Cl: 1, Br: 1, I: 1, At: 1
  };
  var ORGANIC = { B: 1, C: 1, N: 1, O: 1, P: 1, S: 1, F: 1, Cl: 1, Br: 1, I: 1, Se: 1, As: 1, Si: 1 };
  // The valence states a structural formula may leave a main-group atom in. A
  // drawing is not an electron count: sulfur written O=S=O is S(IV) with one lone
  // pair, not a divalent sulfur carrying two hydrogens, and a terminal chlorine is
  // Cl(I) with three lone pairs, never a seven-way claw. Symbols outside this
  // table — the transition metals and the rest — take the drawing at its word and
  // are given no implicit hydrogen.
  var V_STATES = {
    H: [1], D: [1], T: [1],
    Li: [1], Na: [1], K: [1], Rb: [1], Cs: [1], Fr: [1],
    Be: [2], Mg: [2], Ca: [2], Sr: [2], Ba: [2], Ra: [2],
    B: [3], Al: [3], Ga: [3], In: [3], Tl: [1, 3],
    C: [4], Si: [4], Ge: [4], Sn: [2, 4], Pb: [2, 4],
    N: [1, 3, 5], P: [3, 5], As: [3, 5], Sb: [3, 5], Bi: [3, 5],
    O: [2], S: [2, 4, 6], Se: [2, 4, 6], Te: [2, 4, 6], Po: [2, 4, 6],
    F: [1], Cl: [1, 3, 5, 7], Br: [1, 3, 5, 7], I: [1, 3, 5, 7], At: [1, 3, 5, 7],
    He: [0], Ne: [0], Ar: [0], Kr: [0, 2], Xe: [2, 4, 6], Rn: [2, 4]
  };
  // Which state this atom is in: the smallest listed state that can carry the
  // bonds drawn on it. A positive charge buys one bond per unit at the same state
  // (ammonium is still N(III), nitrate still N(V)), a negative one costs a bond
  // because the electron took the hydrogen's place.
  function valenceState(sym, cov, q) {
    var list = V_STATES[sym], need = Math.max(0, cov - (q || 0)), i;
    if (!list) return need;
    for (i = 0; i < list.length; i++) if (list[i] >= need) return list[i];
    return need;
  }
  // The highest state this element can ever reach — how far an unfinished atom may
  // still grow, which is what decides the directions it offers while undecided.
  function highestState(sym) {
    var list = V_STATES[sym];
    if (list) return list[list.length - 1];
    return neutralValence(sym);
  }
  // Pauling electronegativities for the symbols a structural formula actually
  // uses; the game registry carries the full table once it is up.
  var EN_TBL = {
    H: 2.2, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98, Na: 0.93,
    Mg: 1.31, Al: 1.61, Si: 1.9, P: 2.19, S: 2.58, Cl: 3.16, K: 0.82, Ca: 1, Ti: 1.54,
    Cr: 1.66, Mn: 1.55, Fe: 1.83, Co: 1.88, Ni: 1.91, Cu: 1.9, Zn: 1.65, Ga: 1.81, Ge: 2.01,
    As: 2.18, Se: 2.55, Br: 2.96, Rb: 0.82, Sr: 0.95, Ag: 1.93, Cd: 1.69, In: 1.78, Sn: 1.96,
    Sb: 2.05, Te: 2.1, I: 2.66, Cs: 0.79, Ba: 0.89, Pt: 2.28, Au: 2.54, Hg: 2.0, Tl: 1.62,
    Pb: 2.33, Bi: 2.02, Po: 2.0, At: 2.2
  };

  var ELEMENTS = [];      // [{sym,z,name,cat,color,maxBonds,q}]
  var BY_SYM = {};

  function buildElements() {
    var a = app();
    var src = a && a.ELEMENTS && a.ELEMENTS.length ? a.ELEMENTS : null;
    ELEMENTS = [];
    BY_SYM = {};
    var i;
    if (src) {
      for (i = 0; i < src.length; i++) {
        var e = src[i];
        if (!e || !e.sym) continue;
        var ink = INK[e.sym] || e.color || CAT_INK[e.cat] || '#e6edf3';
        var el = {
          sym: e.sym, z: e.z || (i + 1), name: e.name || e.sym, cat: e.cat || 'unknown',
          color: e.color || ink, ink: ink,
          maxBonds: typeof e.maxBonds === 'number' ? e.maxBonds : 4,
          charges: e.charges || null, anion: e.anionCharge || 0, mass: e.mass || 0,
          en: typeof e.en === 'number' ? e.en : (EN_TBL[e.sym] || 0)
        };
        ELEMENTS.push(el);
        BY_SYM[e.sym] = el;
      }
      return;
    }
    for (i = 0; i < SYMS.length; i++) {
      var s = SYMS[i];
      ELEMENTS.push({
        sym: s, z: i + 1, name: s, cat: 'unknown', color: '',
        ink: INK[s] || CAT_INK.unknown, maxBonds: STD_V[s] || 4, charges: null, anion: 0,
        mass: 0, en: EN_TBL[s] || 0
      });
      BY_SYM[s] = ELEMENTS[ELEMENTS.length - 1];
    }
  }
  function elOf(sym) { return BY_SYM[sym] || null; }
  function elNameLocal(el) {
    if (!el) return '';
    var a = app();
    if (a && a.i18n && typeof a.i18n.elName === 'function') {
      try { var n = a.i18n.elName(el); if (n) return n; } catch (e) {}
    }
    return el.name;
  }
  function valenceOf(el) {
    if (!el) return 1;
    if (STD_V[el.sym]) return STD_V[el.sym];
    if (el.charges && el.charges.length) {
      var m = 0;
      for (var i = 0; i < el.charges.length; i++) m = Math.max(m, Math.abs(el.charges[i]));
      if (m > 0) return m;
    }
    if (el.anion) return el.anion;
    return el.maxBonds || 1;
  }
  // The board is painted on a canvas, so CSS alone cannot retheme it: every stroke
  // and fill resolves through this palette, which is rebuilt when the app flips
  // data-theme. The literals are fallbacks for a page with no stylesheet.
  var PAL = null;
  function hexRgb(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function pal() {
    if (PAL) return PAL;
    var light = document.documentElement.dataset.theme === 'light';
    var cs = window.getComputedStyle(document.documentElement);
    function v(name, fb) { var x = cs.getPropertyValue(name); return (x && x.trim()) || fb; }
    var accent = v('--accent', light ? '#0088cc' : '#00d4ff');
    var rgb = hexRgb(accent) || (light ? [0, 136, 204] : [0, 212, 255]);
    function a(al) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + al + ')'; }
    PAL = {
      light: light,
      board: v('--board', light ? '#f7fafc' : '#050912'),
      line: v('--board-line', light ? '#33465e' : '#c8d6e8'),
      grid: v('--board-grid', light ? 'rgba(0,90,140,0.07)' : 'rgba(0,200,255,0.055)'),
      gridMajor: v('--board-grid-major', light ? 'rgba(0,90,140,0.16)' : 'rgba(0,200,255,0.14)'),
      axis: v('--board-axis', light ? 'rgba(0,110,170,0.35)' : 'rgba(0,212,255,0.28)'),
      pos: v('--charge-pos', light ? '#c0392b' : '#ff9c9c'),
      neg: v('--charge-neg', light ? '#1f5fa8' : '#9ecbff'),
      hot: v('--hot', light ? '#9a6700' : '#ffe08a'),
      warn: v('--warn', light ? '#9a6700' : '#ffb300'),
      text: v('--text', light ? '#1a2a40' : '#e0f0ff'),
      ink: light ? '#1a2a40' : '#e6edf3',
      accent: accent,
      a: a,
      electron: light ? 'rgba(0,110,170,0.85)' : 'rgba(120,225,255,0.9)',
      over: light ? 'rgba(192,57,43,0.6)' : 'rgba(255,80,110,0.65)',
      lpJoint: light ? 'rgba(70,90,120,0.13)' : 'rgba(150,170,200,0.13)'
    };
    return PAL;
  }
  // Readable ink for whichever board is showing. On dark, a colour whose relative
  // luminance is too low (Hf, Rf, …) is lifted towards white; on light, a pale one
  // (C, N, …) is dropped towards black. Both keep the hue, so the element keeps its
  // identity instead of being replaced by a generic colour.
  function legible(hex) {
    var P = pal();
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
    if (!m) return P.ink;
    var n = parseInt(m[1], 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    function ch(x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
    function lum(R, G, B) { return 0.2126 * ch(R) + 0.7152 * ch(G) + 0.0722 * ch(B); }
    var L = lum(r, g, b);
    if (!P.light) {
      if (L >= 0.22) return hex;
      var t = Math.min(1, (0.3 - L) / Math.max(0.001, 1 - L));
      function up(x) { return Math.round(x + (248 - x) * t); }
      return 'rgb(' + up(r) + ',' + up(g) + ',' + up(b) + ')';
    }
    // 0.14 against the #f7fafc board is a 5:1 contrast ratio, the floor for 15px text.
    if (L <= 0.15) return hex;
    var lo = 0, hi = 1, s = 1;
    for (var it = 0; it < 24; it++) {
      s = (lo + hi) / 2;
      if (lum(r * s, g * s, b * s) > 0.14) hi = s; else lo = s;
    }
    function dn(x) { return Math.round(x * s); }
    return 'rgb(' + dn(r) + ',' + dn(g) + ',' + dn(b) + ')';
  }

  // ==========================================================================
  // 3. Editor state.
  // ==========================================================================
  var doc = {
    atoms: [],          // [{id,sym,x,y,q,lp}]
    bonds: [],          // [{id,a,b,order}]
    brackets: [],       // [{key:'1,2',ids:[..],q:number|null}]
    nextId: 1
  };
  var ui = {
    open: false, min: false, tool: 'select', el: 'C', bond: 1,
    zoom: 1, pan: { x: 0, y: 0 }, grid: true, snap: true,
    showH: true, showQ: true, showLP: true, shells: false, vsepr: true,
    sel: [],            // array of atom ids, in selection order
    clip: null, hover: null, drag: null, box: null, previewBond: null,
    ptrs: {}, pinch: null, down: null, movedFar: false, pendingBond: 0,
    space: false, pasteAt: null, lastPointer: null, alt: false,
    hist: [], future: [], cur: '', help: false, rev: 1
  };
  var els = {};
  var dpr = 1;
  var view = null;      // last render view-model, also used for hit-testing
  var elPopOpen = false;
  var saveTimer = 0;
  var lastLang = '';

  function selHas(id) { return ui.sel.indexOf(id) >= 0; }
  function atomById(id) {
    for (var i = 0; i < doc.atoms.length; i++) if (doc.atoms[i].id === id) return doc.atoms[i];
    return null;
  }
  function bondBetween(a, b) {
    for (var i = 0; i < doc.bonds.length; i++) {
      var x = doc.bonds[i];
      if ((x.a === a && x.b === b) || (x.a === b && x.b === a)) return x;
    }
    return null;
  }
  function bondsOf(id) {
    var out = [];
    for (var i = 0; i < doc.bonds.length; i++) {
      var x = doc.bonds[i];
      if (x.a === id || x.b === id) out.push(x);
    }
    return out;
  }
  function orderSum(id) {
    var s = 0, bs = bondsOf(id);
    for (var i = 0; i < bs.length; i++) s += Math.max(1, bs[i].order || 1);
    return s;
  }
  function newId() { return doc.nextId++; }
  function components() {
    var seen = {}, out = [];
    for (var i = 0; i < doc.atoms.length; i++) {
      var root = doc.atoms[i].id;
      if (seen[root]) continue;
      var stack = [root], group = [];
      seen[root] = 1;
      while (stack.length) {
        var id = stack.pop();
        group.push(id);
        var bs = bondsOf(id);
        for (var j = 0; j < bs.length; j++) {
          var o = bs[j].a === id ? bs[j].b : bs[j].a;
          if (!seen[o]) { seen[o] = 1; stack.push(o); }
        }
      }
      group.sort(function (x, y) { return x - y; });
      out.push(group);
    }
    return out;
  }
  // Rings = every bond that is not on the spanning forest.
  function ringBonds() {
    var seen = {}, parent = {}, ring = [];
    var comps = components();
    for (var c = 0; c < comps.length; c++) {
      var stack = [comps[c][0]];
      seen[comps[c][0]] = 1;
      while (stack.length) {
        var id = stack.pop();
        var bs = bondsOf(id);
        for (var i = 0; i < bs.length; i++) {
          var b = bs[i], o = b.a === id ? b.b : b.a;
          if (!seen[o]) { seen[o] = 1; parent[o] = id; stack.push(o); }
          else if (parent[id] !== o && parent[o] !== id) {
            var key = b.a < b.b ? b.a + '-' + b.b : b.b + '-' + b.a;
            if (ring.indexOf(key) < 0) ring.push(key);
          }
        }
      }
    }
    return ring;
  }
  function ringCount() { return ringBonds().length; }
  function netCharge(ids) {
    var q = 0;
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (a) q += (a.q || 0);
    }
    return q;
  }
  // Covalent bookkeeping. The shipped engine counts a shared bond and a
  // transferred bond separately (orderSumOf/ionicCountOf), so the editor keeps the
  // same two sums and never lets an electron transfer eat a valence slot.
  function covSum(id) {
    var s = 0, bs = bondsOf(id);
    for (var i = 0; i < bs.length; i++) if (!bs[i].ionic) s += Math.max(1, bs[i].order || 1);
    return s;
  }
  function ionSum(id) {
    var s = 0, bs = bondsOf(id);
    for (var i = 0; i < bs.length; i++) if (bs[i].ionic) s += Math.max(1, bs[i].order || 1);
    return s;
  }

  // ==========================================================================
  // 2b. Bond legality.
  //     The game owns the chemistry rules; they are published as window.__mol3d.chem.
  //     The editor builds the atom/bond maps those rules expect and asks before a
  //     line reaches the board, so a drawing can never promise a structure the 3D
  //     scene will refuse — and a noble gas can neither be bonded here nor be shown
  //     as if it were. Nothing is re-implemented: refusal wording comes back through
  //     the game's own i18n, in the language the player is playing in.
  // ==========================================================================
  function rules() {
    var a = app();
    return a && a.chem ? a.chem : null;
  }
  // The registry's own element object, so every field the rules read is the real
  // one (cat, valenceElectrons, charges, anionCharge) and not an editor copy.
  function gameEl(sym) {
    var r = rules();
    if (r && typeof r.elementBySym === 'function') {
      try { var e = r.elementBySym(sym); if (e) return e; } catch (err) { /* fall through */ }
    }
    return elOf(sym);
  }
  function ruleAtoms() {
    var m = new Map();
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      m.set(a.id, { id: a.id, el: gameEl(a.sym) });
    }
    return m;
  }
  function ruleBonds() {
    var m = new Map();
    for (var i = 0; i < doc.bonds.length; i++) {
      var b = doc.bonds[i];
      m.set(b.id, { id: b.id, a: b.a, b: b.b, order: Math.max(1, b.order || 1), ionic: !!b.ionic });
    }
    return m;
  }
  function trReason(reason) {
    if (!reason) return '';
    var a = app();
    if (a && a.i18n && typeof a.i18n.t === 'function') {
      try {
        var s = a.i18n.t(reason.key, reason.p);
        if (s && s !== reason.key) return s;
      } catch (err) { /* fall through */ }
    }
    return String(reason.key || '');
  }
  // Raise one approved order at a time, moving the working sums with every step
  // that passes; upgradeCheck measures the bond it is handed as the next order up.
  // The climb stops at the order that was asked for: a single bond must stay a
  // single bond wherever a double would also have been legal.
  function stepUp(r, am, bm, rec, want) {
    var top = rec.order, reason = null;
    for (var o = rec.order + 1; o <= want && o <= 5; o++) {
      var up = r.upgradeCheck(am, bm, { id: rec.id, a: rec.a, b: rec.b, order: o, ionic: rec.ionic });
      if (!up.ok) { reason = up.reason; break; }
      rec.order = o;
      top = o;
    }
    return { order: top, reason: reason };
  }
  // A bond the player asked for between two atoms that are not yet joined.
  function bondPlan(aId, bId, want) {
    var r = rules();
    want = Math.max(1, Math.round(want || 1));
    if (!r) return { ok: true, type: 'covalent', order: want };
    var am = ruleAtoms(), bm = ruleBonds();
    var chk = r.bondCheck(am, bm, aId, bId);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    var rec = { id: 'plan', a: aId, b: bId, order: 1, ionic: chk.type === 'ionic' };
    bm.set('plan', rec);
    var s = stepUp(r, am, bm, rec, want);
    return { ok: true, type: chk.type, order: s.order, reason: s.reason, short: s.order < want };
  }
  // A bond whose end(s) are not on the board yet: the atoms are attached only for
  // the length of the question, so a refused bond leaves nothing behind to undo.
  function probePlan(probes, aId, bId, want) {
    var n = doc.atoms.length;
    for (var i = 0; i < probes.length; i++) doc.atoms.push(probes[i]);
    var plan;
    try { plan = bondPlan(aId, bId, want); }
    finally { doc.atoms.length = n; }
    return plan;
  }
  // An existing bond, raised toward want. Stopping short is reported with the
  // game's own reason so the player learns which rule stopped them.
  function raisePlan(bond, want) {
    var r = rules();
    want = Math.max(1, Math.round(want || 1));
    if (!r) return { ok: true, order: want };
    var am = ruleAtoms(), bm = ruleBonds();
    var rec = bm.get(bond.id);
    if (!rec) return { ok: false, order: Math.max(1, bond.order || 1) };
    var s = stepUp(r, am, bm, rec, want);
    return { ok: s.order >= want, order: s.order, reason: s.reason };
  }
  // The highest order this bond could legally reach right now.
  function headroom(bond) {
    var r = rules();
    if (!r) return 5;
    var am = ruleAtoms(), bm = ruleBonds();
    var rec = bm.get(bond.id);
    if (!rec) return Math.max(1, bond.order || 1);
    return stepUp(r, am, bm, rec, 5).order;
  }
  // The two numbers the engine measures an atom against: how many shared pairs it
  // can coordinate at all, and how many it makes while carrying no formal charge.
  // Both are read from the game's own element record, so the editor's flags and the
  // scene's verdicts can never disagree.
  function capacityOf(sym) {
    var r = rules();
    if (r && typeof r.orderCapacityOf === 'function') {
      try { var c = r.orderCapacityOf(gameEl(sym)); if (c) return c; } catch (err) { /* fall through */ }
    }
    return valenceOf(elOf(sym));
  }
  function neutralValence(sym) {
    var r = rules();
    if (r && typeof r.neutralCovalenceOf === 'function') {
      try { var c = r.neutralCovalenceOf(gameEl(sym)); if (c) return c; } catch (err) { /* fall through */ }
    }
    return valenceOf(elOf(sym));
  }
  // Audit of the whole board: every bond re-asked from nothing, so a document that
  // predates these rules (or arrived from a file) cannot keep an illegal line.
  function auditBonds() {
    var r = rules();
    if (!r) return [];
    var bad = [];
    for (var i = 0; i < doc.bonds.length; i++) {
      var b = doc.bonds[i];
      var am = ruleAtoms(), bm = ruleBonds();
      bm.delete(b.id);
      var chk = r.bondCheck(am, bm, b.a, b.b);
      if (!chk.ok) { bad.push({ id: b.id, reason: chk.reason }); continue; }
      var rec = { id: b.id, a: b.a, b: b.b, order: 1, ionic: chk.type === 'ionic' };
      bm.set(b.id, rec);
      var s = stepUp(r, am, bm, rec, Math.max(1, b.order || 1));
      if (s.order < (b.order || 1)) bad.push({ id: b.id, reason: s.reason, order: s.order });
      else if (!!b.ionic !== rec.ionic) bad.push({ id: b.id, retype: rec.ionic });
    }
    return bad;
  }
  // Bring a board that did not arrive through the drawing tools — a preset, a
  // loaded file, a document saved before these rules existed, an atom whose
  // element was just painted over — back inside them, and report what had to
  // change. A bond the rules refuse outright cannot stay on the board, because
  // the board is a promise the 3D scene would have to break.
  // One correction per pass, then the board is asked again: a bond cut for one
  // atom usually frees the neighbours that were only over the line because of it,
  // so repairing everything found in a single sweep would cut four bonds where
  // the rules need one gone.
  function repairBoard() {
    var notes = [], pass = 0;
    while (pass++ < 200) {
      var bad = auditBonds();
      if (!bad.length) break;
      if (!applyRepair(bad[0], notes)) break;
    }
    return notes;
  }
  // The one fix for one flagged bond. False means the board cannot move, so the
  // caller stops rather than looping on a fault it has already applied.
  function applyRepair(item, notes) {
    var b = bondById(item.id);
    if (!b) return false;
    var A = atomById(b.a), B = atomById(b.b);
    var pair = A && B ? A.sym + '–' + B.sym : '';
    if (item.order === void 0 && item.retype === void 0) {
      removeBond(b.id);
      notes.push(pair + ': ' + trReason(item.reason));
      return true;
    }
    if (item.retype !== void 0) {
      if (!!b.ionic === item.retype) return false;
      b.ionic = item.retype;
      return true;
    }
    if (b.order === item.order) return false;
    b.order = item.order;
    notes.push(pair + ' → ' + ordGlyph(b.order) + ': ' + trReason(item.reason));
    return true;
  }

  // ==========================================================================
  // 2c. Geometry: bond lengths and VSEPR joints.
  //     A structural formula is a shape, not a scatter of letters. Distances come
  //     from the scene's own ball-and-stick measure (window.__mol3d.chem.bondLength
  //     — the very function the 3D builder calls), directions come from VSEPR: the
  //     atoms around a centre plus its lone pairs fix the steric number, and the
  //     steric number fixes the angles. An atom therefore lands on a joint of the
  //     structure, never wherever the pointer happened to stop; Alt is the one
  //     deliberate escape, for parking a fragment wherever it is wanted.
  // ==========================================================================
  var TAU = Math.PI * 2;
  var D2R = Math.PI / 180;
  var JOINT_GRAB = GRID * 1.15;       // inside this, the click was on the joint
  var JOINT_MAGNET = BOND_LEN * 1.55; // near a structure the joint still wins
  var CC_ANG = -1;

  // Valence electrons for the handful of cases the registry is not up for. The
  // game's own table is used whenever it is there; this only keeps the geometry
  // sane if the editor is opened before the scene finishes booting.
  var VA_E = {
    H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8, Na: 1, Mg: 2, Al: 3,
    Si: 4, P: 5, S: 6, Cl: 7, Ar: 8, K: 1, Ca: 2, Ga: 3, Ge: 4, As: 5, Se: 6, Br: 7, Kr: 8,
    Rb: 1, Sr: 2, In: 3, Sn: 4, Sb: 5, Te: 6, I: 7, Xe: 8, Cs: 1, Ba: 2, Tl: 1, Pb: 2,
    Bi: 3, Po: 6, At: 7, Rn: 8
  };

  function engineAng(symA, symB, ionic) {
    var r = rules(), ea = gameEl(symA), eb = gameEl(symB);
    if (!ea || !eb) return 0;
    if (r && typeof r.bondLength === 'function') {
      try {
        var L = r.bondLength(ea, eb, !!ionic);
        if (L > 0 && isFinite(L)) return L;
      } catch (err) { /* fall back to the radii below */ }
    }
    if (typeof ea.radius === 'number' && typeof eb.radius === 'number') {
      var s = (ea.radius + eb.radius) / 55;   // the scene's own formula
      return ionic ? s * 1.18 : s;
    }
    return 0;
  }
  function ccAng() {
    if (CC_ANG < 0) CC_ANG = engineAng('C', 'C', false);
    return CC_ANG;
  }
  // The scene's angstroms are ball-packing units (its C–C is 2.764), so the board
  // is calibrated on the measure it already uses: one C–C is BOND_LEN. The other
  // pairs keep the scene's proportions, reinseded into a band a drawing can read —
  // Na–Cl is 1.8× a C–C in the scene, which is true but not something a 2D bond
  // should ever look like.
  function lengthPx(symA, symB, ionic) {
    var ang = engineAng(symA, symB, ionic), base = ccAng();
    if (!(ang > 0) || !(base > 0)) return BOND_LEN;
    var k = ang / base;
    k = Math.max(0.74, Math.min(ionic ? 1.42 : 1.18, k));
    return Math.round(BOND_LEN * k * 100) / 100;
  }

  function normAng(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  function angDist(a, b) { return Math.abs(normAng(a - b)); }

  function valenceElectrons(sym) {
    var el = gameEl(sym);
    if (el && typeof el.valenceElectrons === 'number' && isFinite(el.valenceElectrons)) return el.valenceElectrons;
    return VA_E[sym] || 0;
  }
  function isMetalSym(sym) {
    var r = rules();
    if (r && typeof r.isMetal === 'function') {
      try { return !!r.isMetal(sym); } catch (err) { /* fall through */ }
    }
    var el = gameEl(sym);
    return !!(el && /alkali|alkaline|transition|post|lanthanide|actinide/.test(String(el.cat)));
  }
  // Hydrogens the drawing leaves out but the valence still owes — the same open
  // valences the add-hydrogens button fills. They are invisible and they still
  // hold their room: a chain carbon drawn with two neighbours is a four-domain
  // centre, and drawing it as a two-domain one would make every alkane a ruler.
  function implicitH(a) {
    if (!a || a.sym === 'H') return 0;
    if (isMetalSym(a.sym)) return 0;
    var cov = covSum(a.id), q = a.q || 0;
    var owed = valenceState(a.sym, cov, q) - Math.max(0, cov - q);
    return Math.max(0, Math.min(4, Math.round(owed)));
  }
  function autoLP(a) {
    var bonds = covSum(a.id) + implicitH(a);
    var left = valenceElectrons(a.sym) - (a.q || 0) - bonds;
    return Math.max(0, Math.floor(left / 2));
  }
  // The lone-pair tool is an override; until it is used the count is the engine's
  // own electron bookkeeping, so water shows two pairs without being told to.
  function lpCount(a) {
    if (!a) return 0;
    if (a.lpSet) return Math.max(0, a.lp | 0);
    return autoLP(a);
  }
  // The lone-pair tool is the one way to overrule that bookkeeping; a count that
  // lands back on the automatic number hands the decision back to the engine.
  function setLP(a, n) {
    n = Math.max(0, Math.min(6, Math.round(n) || 0));
    a.lp = n;
    a.lpSet = n === autoLP(a) ? 0 : 1;
    return n;
  }

  // The angle between two neighbouring bonded domains.
  function domainGap(cn, lp) {
    if (cn <= 1) return 0;
    var sn = cn + lp;
    if (lp === 0) {
      if (sn === 2) return Math.PI;
      if (sn === 3) return 120 * D2R;
      if (sn === 4) return 90 * D2R;     // tetrahedral, drawn as the cross
      if (sn === 5) return 72 * D2R;
      if (sn === 6) return 60 * D2R;
      return TAU / cn;
    }
    if (sn <= 2) return Math.PI;
    if (sn === 3) return cn === 2 ? 119 * D2R : 120 * D2R;   // AX2E (SO2) / AX3
    if (sn === 4) return cn === 2 ? 104.5 * D2R : cn === 3 ? 107 * D2R : 90 * D2R;
    if (sn === 5) return cn === 2 ? Math.PI : 90 * D2R;      // AX2E3 / AX3E2 / AX4E
    if (sn === 6) return cn === 2 ? Math.PI : 90 * D2R;      // AX2E4 / AX4E2
    return TAU / Math.max(3, cn);
  }
  function evenDirs(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(i * TAU / n - Math.PI / 2);
    return out;
  }
  // The full arrangement of domains around a centre: the bonded ones (real bonds
  // and the hydrogens the drawing left implicit) and the lone pairs, which share
  // the circle and push the bonds together.
  function shapeDirs(cn, lp, sym) {
    // A centre with nothing to point, or with a single bond that has not decided
    // its shape yet, gets the directions its highest valence state can still grow
    // into. They are only an invitation: the settle replaces them with the model
    // the moment the atom has enough neighbours to have a shape.
    if (cn <= 1) {
      var hub = isMetalSym(sym) ? 6 : Math.max(2, Math.min(6, highestState(sym)));
      return { bonds: evenDirs(hub), lps: [] };
    }
    var gap = domainGap(cn, lp);
    if (!gap) return { bonds: [0], lps: [] };
    if (lp === 0) return { bonds: evenDirs(cn), lps: [] };
    if (gap * (cn - 1) >= Math.PI * 1.72) return { bonds: evenDirs(cn), lps: [] };
    var span = gap * (cn - 1), bonds = [], i;
    for (i = 0; i < cn; i++) bonds.push(-span / 2 + gap * i);
    var rest = TAU - span, lps = [];
    for (i = 0; i < lp; i++) lps.push(Math.PI + (i - (lp - 1) / 2) * (rest / (lp + 1)));
    return { bonds: bonds, lps: lps };
  }
  // Rotate the ideal arrangement so it lies as well as it can over the bonds that
  // are already drawn: an atom that has been built up joint by joint keeps its
  // orientation, and its free slots are the joints the next atom drops into.
  function fitRotation(can, drawn) {
    if (!can.length || !drawn.length) return 0;
    var best = 0, bestScore = Infinity, i, j, k;
    for (i = 0; i < drawn.length; i++) {
      for (j = 0; j < can.length; j++) {
        var phi = normAng(drawn[i] - can[j]), s = 0;
        for (k = 0; k < drawn.length; k++) {
          var m = Math.PI;
          for (var t = 0; t < can.length; t++) m = Math.min(m, angDist(drawn[k], phi + can[t]));
          s += m * m;
        }
        if (s < bestScore - 1e-9) { bestScore = s; best = phi; }
      }
    }
    return best;
  }
  // Covalent neighbours hold a slot; ionic contacts are electrostatic and point
  // wherever the counter-ion happens to be, so they never claim a VSEPR direction.
  function drawnDirs(id) {
    var me = atomById(id), out = [];
    if (!me) return out;
    var bs = bondsOf(id);
    for (var i = 0; i < bs.length; i++) {
      if (bs[i].ionic) continue;
      var o = atomById(bs[i].a === id ? bs[i].b : bs[i].a);
      if (!o) continue;
      var dx = o.x - me.x, dy = o.y - me.y;
      if (!dx && !dy) { out.push({ ang: 0, id: o.id }); continue; }
      out.push({ ang: Math.atan2(dy, dx), id: o.id });
    }
    return out;
  }
  // The shape a centre will have once the bond being offered actually lands.
  // Joints are asked for before the atom exists, so a sulphur sitting on four
  // fluorines is shown the six positions of the octahedron it is becoming rather
  // than the five domains of the molecule it is today. Without that, the fifth
  // joint of SF6 has nowhere to go and the next atom falls onto a neighbouring
  // halogen instead — a chain the rules allow and the user never meant.
  function jointShape(a, addOrder) {
    var cn = drawnDirs(a.id).length;
    if (!addOrder) return shapeDirs(cn + implicitH(a), lpCount(a), a.sym);
    var cov = covSum(a.id) + addOrder, q = a.q || 0;
    var owed = Math.max(0, Math.min(4, Math.round(valenceState(a.sym, cov, q) - Math.max(0, cov - q))));
    var land = cn + 1 + owed;
    var left = valenceElectrons(a.sym) - q - (cov + owed);
    var lp = a.lpSet ? Math.max(0, a.lp | 0) : Math.max(0, Math.floor(left / 2));
    // A centre the rules still let grow is shown the directions of the arrangement
    // it is heading for, not of the intermediate molecule it happens to be today:
    // phosphorus is a pentagon from its first chlorine, so the fifth drop finds its
    // joint where the player aimed instead of in the gap the third one left behind.
    // The settled shape is still the honest one — stop at three chlorines and the
    // pyramid appears, and the lone-pair dots keep their real angles.
    var hub = a.lpSet ? land
      : isMetalSym(a.sym) ? 6
      : Math.max(2, Math.min(6, Math.min(highestState(a.sym), capacityOf(a.sym))));
    if (hub > land) return shapeDirs(hub, 0, a.sym);
    return shapeDirs(land, lp, a.sym);
  }
  // The places a new atom may sit against this one: every free bonded slot, and
  // behind them the lone-pair slots, which is how H2O takes its third hydrogen.
  function slotsOf(a, ionic, addOrder) {
    if (!a) return [];
    var drawn = drawnDirs(a.id);
    var sh = ionic ? { bonds: evenDirs(6), lps: [] } : jointShape(a, addOrder);
    var phi = fitRotation(sh.bonds.concat(sh.lps), drawn.map(function (d) { return d.ang; }));
    var out = [], i, j;
    for (i = 0; i < sh.bonds.length; i++) out.push({ ang: normAng(sh.bonds[i] + phi), kind: 'bond' });
    for (i = 0; i < sh.lps.length; i++) out.push({ ang: normAng(sh.lps[i] + phi), kind: 'lp' });
    for (i = 0; i < out.length; i++) {
      for (j = 0; j < drawn.length; j++) {
        if (angDist(out[i].ang, drawn[j].ang) < 42 * D2R) { out[i].taken = true; break; }
      }
    }
    return out;
  }
  // The directions the lone pairs of this atom actually occupy, so the dots on the
  // board are drawn where the VSEPR model puts them rather than in whichever of
  // eight compass points happens to be clear of a bond.
  function lpDirsOf(a) {
    var sl = slotsOf(a, false), out = [];
    for (var i = 0; i < sl.length; i++) {
      if (sl[i].kind === 'lp' && !sl[i].taken) out.push(sl[i].ang);
    }
    return out;
  }
  function blockedAt(x, y, skipId, len, skip) {
    var keep = Math.max(26, len * 0.62);
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      if (a.id === skipId || (skip && skip[a.id])) continue;
      if (Math.hypot(a.x - x, a.y - y) < keep) return true;
    }
    return false;
  }
  // Every joint on the board where `sym` could legally be dropped right now. The
  // legality question is asked once per parent atom, through the same rules every
  // other drawing path goes through, so a joint is never a promise the scene
  // breaks. Cached against the document, rebuilt by the edit that changed it.
  var jointCache = { key: '', list: null };
  // Joints are positions, not just topology: dragging a fragment across the board
  // has to invalidate the cache even though no atom was added or removed, so the
  // shape of the document is mixed into the key.
  function shapeKey() {
    var h = 2166136261, i;
    for (i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      h = (h ^ Math.round(a.x * 4)) * 16777619 >>> 0;
      h = (h ^ Math.round(a.y * 4)) * 16777619 >>> 0;
      h = (h ^ a.id) * 16777619 >>> 0;
    }
    return h;
  }
  function allJoints(sym, wantOrder) {
    var key = [ui.rev, sym, wantOrder, doc.atoms.length, doc.bonds.length, shapeKey()].join('|');
    if (jointCache.key === key && jointCache.list) return jointCache.list;
    var out = [], probe = { id: '~jnt', sym: sym, x: 0, y: 0, q: 0, lp: 0 };
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      var plan = probePlan([probe], a.id, '~jnt', wantOrder);
      if (!plan.ok) continue;
      var len = lengthPx(a.sym, sym, plan.type === 'ionic');
      var slots = slotsOf(a, plan.type === 'ionic', plan.order);
      // Which atom gets the new bond. Joints are drawn from the atom already on
      // the board, and the ones that have to be preferred are the ones the
      // structure is actually missing: an atom that still owes its valence a
      // bond first, an atom whose valence is full but whose coordination can
      // still rise next, an atom standing alone last of all because its
      // directions are only an invitation to begin. Within one class the atom
      // with more neighbours wins, so the skeleton grows before its ends: the
      // fifth chlorine of PCl5 belongs to phosphorus even when a terminal
      // chlorine is sitting right where the pointer is.
      var deg = drawnDirs(a.id).length;
      var rank = !plan.type && !deg ? 2 : (implicitH(a) > 0 ? 0 : 1);
      for (var j = 0; j < slots.length; j++) {
        if (slots[j].taken) continue;
        var x = a.x + Math.cos(slots[j].ang) * len, y = a.y + Math.sin(slots[j].ang) * len;
        if (blockedAt(x, y, a.id, len)) continue;
        out.push({
          x: x, y: y, ang: slots[j].ang, kind: slots[j].kind, rank: rank, deg: deg, parent: a.id,
          order: plan.order, ionic: plan.type === 'ionic', len: len,
          short: plan.short, reason: plan.reason
        });
      }
    }
    if (key) jointCache = { key: key, list: out };
    return out;
  }
  // The single number every joint list is ordered by: class, then how built-up
  // the atom is, then whether the slot is a real bonding direction or a lone
  // pair standing in for one, then whether the centre had to make room for it,
  // then the distance the player actually aimed at.
  function jointWeight(t) {
    return t.rank * 1e9 - t.deg * 1e6 + (t.kind === 'lp' ? 1e3 : 0) + (t.room ? 5e5 : 0) + (t.dist || 0);
  }
  // The joints of `all` the pointer can actually reach, copied with the distance
  // it aimed past.
  function collectJoints(all, x, y, reach) {
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var j = all[i];
      var d = Math.hypot(j.x - x, j.y - y);
      if (d > reach) continue;
      out.push({ x: j.x, y: j.y, ang: j.ang, kind: j.kind, rank: j.rank, deg: j.deg, parent: j.parent,
        order: j.order, ionic: j.ionic, len: j.len, short: j.short, reason: j.reason, dist: d });
    }
    return out;
  }
  // One-to-one assignment of the drawn bonds onto distinct slots of a rotated
  // target, cheapest angular cost first, returning the slots left over. The slot
  // `anchor` is held back for the bond that is being drawn now, so the best fit
  // can never hand the door it opened to a bond that was already there. Greedy is
  // enough here: the sets are at most six wide and the answer only has to leave a
  // door open, not be perfect.
  function freeSlotsAfterAssign(slots, phi, drawn, anchor) {
    var cand = [], i, j;
    for (i = 0; i < drawn.length; i++)
      for (j = 0; j < slots.length; j++) {
        if (j === anchor) continue;
        cand.push({ n: i, s: j, d: angDist(normAng(slots[j].ang + phi), drawn[i].ang) });
      }
    cand.sort(function (p, q) { return p.d - q.d; });
    var bn = {}, bs = {}, used = 0, cost = 0;
    for (i = 0; i < cand.length && used < drawn.length; i++) {
      var c = cand[i];
      if (bn[c.n] || bs[c.s]) continue;
      bn[c.n] = 1; bs[c.s] = 1; cost += c.d * c.d; used++;
    }
    if (used < drawn.length) return null;
    var free = [];
    if (anchor !== undefined && anchor >= 0)
      free.push({ ang: normAng(slots[anchor].ang + phi), kind: slots[anchor].kind });
    for (j = 0; j < slots.length; j++)
      if (j !== anchor && !bs[j]) free.push({ ang: normAng(slots[j].ang + phi), kind: slots[j].kind });
    return { free: free, cost: cost };
  }
  // The last resort of a growing centre. A tetrafluoride sits in a square, four
  // bonds ninety degrees apart, and the octahedron it is heading for has six slots
  // sixty degrees apart — no rotation of one fits inside the other, so every slot
  // falls within the taken window of a bond and the centre offers no door at all:
  // the fifth fluorine has nowhere to land and would settle on a neighbour instead,
  // which the rules permit and the player never meant. So the arrangement is asked
  // a different question: anchor one slot under the pointer, hand the bonds that
  // are already drawn the best of the remaining slots, and open whatever is left.
  // The settle afterwards spaces the finished molecule properly; this only has to
  // keep it buildable.
  function roomJoints(x, y, sym, wantOrder) {
    var out = [], probe = { id: '~room', sym: sym, x: 0, y: 0, q: 0, lp: 0 };
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      var reach = Math.hypot(x - a.x, y - a.y);
      if (reach > JOINT_MAGNET * 1.7) continue;
      var plan = probePlan([probe], a.id, '~room', wantOrder);
      if (!plan.ok) continue;
      var len = lengthPx(a.sym, sym, plan.type === 'ionic');
      if (reach > len * 1.7) continue;
      var drawn = drawnDirs(a.id);
      var sh = plan.type === 'ionic' ? { bonds: evenDirs(6), lps: [] } : jointShape(a, plan.order);
      var slots = [], k;
      for (k = 0; k < sh.bonds.length; k++) slots.push({ ang: sh.bonds[k], kind: 'bond' });
      for (k = 0; k < sh.lps.length; k++) slots.push({ ang: sh.lps[k], kind: 'lp' });
      if (slots.length <= drawn.length) continue;
      // The neighbours of the atom being grown are not in the way: they are about
      // to move onto the new arrangement with it. A square of four bonds has no
      // room for a sixth direction measured against where those four sit today,
      // but the settle that follows the bond spaces all six properly, so the door
      // is real even while the geometry around it is still half-built.
      var moving = {};
      for (k = 0; k < doc.bonds.length; k++) {
        var bd = doc.bonds[k];
        if (bd.a === a.id) moving[bd.b] = 1; else if (bd.b === a.id) moving[bd.a] = 1;
      }
      var aim = Math.atan2(y - a.y, x - a.x), best = null;
      for (k = 0; k < slots.length; k++) {
        var got = freeSlotsAfterAssign(slots, normAng(aim - slots[k].ang), drawn, k);
        if (!got || !got.free.length) continue;
        if (!best || best.cost > got.cost) best = got;
      }
      if (!best) continue;
      var deg = drawn.length;
      var rank = !plan.type && !deg ? 2 : (implicitH(a) > 0 ? 0 : 1);
      for (k = 0; k < best.free.length; k++) {
        var ang = best.free[k].ang;
        var px = a.x + Math.cos(ang) * len, py = a.y + Math.sin(ang) * len;
        out.push({ x: px, y: py, ang: ang, kind: best.free[k].kind, rank: rank, deg: deg, parent: a.id,
          order: plan.order, ionic: plan.type === 'ionic', len: len,
          short: plan.short, reason: plan.reason, dist: Math.hypot(px - x, py - y), room: 1 });
      }
    }
    out.sort(function (p, q) { return jointWeight(p) - jointWeight(q); });
    return out;
  }
  function jointsNear(x, y, sym, wantOrder) {
    var out = collectJoints(allJoints(sym, wantOrder), x, y, JOINT_MAGNET);
    // The doors a centre keeps open for the arrangement it is heading for, even
    // when the shape it has today already covers every one of them. Added to the
    // normal list rather than used only when it is empty: at the fifth fluorine of
    // SF6 the terminal fluorines still offer joints, so an empty-list fallback
    // would never fire and the bond would land on a neighbour the player never
    // meant. The ranking sends it to sulfur anyway, and the room penalty below
    // keeps a made-room joint from ever beating a real one on the same atom.
    var room = roomJoints(x, y, sym, wantOrder);
    for (var i = 0; i < room.length; i++) {
      if (room[i].dist > JOINT_MAGNET * 1.8) continue;
      out.push(room[i]);
    }
    out.sort(function (p, q) { return jointWeight(p) - jointWeight(q); });
    return out;
  }
  function jointsOf(parentId, sym, wantOrder) {
    var all = allJoints(sym, wantOrder), out = [];
    for (var i = 0; i < all.length; i++) if (all[i].parent === parentId) out.push(all[i]);
    return out;
  }

  // ==========================================================================
  // 4. Styles. Inline in the asset, scoped to #bp-panel / .bp-*, so nothing here
  //    can leak into the game's own sheets. z-index 1000 is the house value for a
  //    working panel (the isomer drawer); every game overlay lives at 9999+.
  // ==========================================================================
  var CSS = [
    '#bp-panel{position:fixed;z-index:1000;display:none;flex-direction:column;width:740px;height:520px;',
    'min-width:320px;min-height:250px;left:80px;top:84px;overflow:hidden;box-sizing:border-box;',
    'background:var(--panel,rgba(12,18,35,.93));border:1px solid var(--border,rgba(0,200,255,.18));',
    'border-radius:12px;box-shadow:var(--panel-shadow,0 10px 38px rgba(0,0,0,.62));',
    'color:var(--text,#e0f0ff);font-family:inherit;font-size:12px;touch-action:manipulation}',
    '#bp-panel.open{display:flex}',
    '#bp-panel *{box-sizing:border-box}',
    '#bp-head{display:flex;align-items:center;gap:6px;padding:6px 8px;flex:none;cursor:move;',
    'border-bottom:1px solid var(--border,rgba(0,200,255,.15));',
    'background:linear-gradient(180deg,var(--accent-soft,rgba(0,212,255,.10)),transparent);user-select:none;touch-action:none}',
    '#bp-badge{flex:none;font-size:9px;font-weight:800;letter-spacing:.09em;padding:3px 5px;border-radius:5px;',
    'background:var(--accent,#00d4ff);color:var(--on-accent,#04121c)}',
    '#bp-title{flex:none;font-size:12px;font-weight:700;color:var(--accent,#00d4ff);white-space:nowrap}',
    '#bp-readout{flex:1 1 auto;min-width:0;text-align:right;font-size:11px;line-height:1.2;',
    'color:var(--muted,#5a7a9a);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#bp-readout b{color:var(--text,#e0f0ff);font-size:12px}',
    '#bp-readout sub{font-size:8px;vertical-align:-1px}',
    '#bp-readout .bp-chg{color:var(--warn,#ffaa00)}',
    '.bp-hbtn{flex:none;width:22px;height:22px;line-height:1;padding:0;border-radius:6px;cursor:pointer;',
    'border:1px solid var(--border,rgba(0,200,255,.2));background:var(--panel-2,rgba(18,26,48,.9));',
    'color:var(--text,#e0f0ff);font-size:12px;font-family:inherit}',
    '.bp-hbtn:hover{border-color:var(--accent,#00d4ff);color:var(--accent,#00d4ff)}',
    '#bp-elbar{display:flex;align-items:center;gap:5px;padding:5px 8px;flex:none;flex-wrap:wrap;',
    'border-bottom:1px solid var(--border,rgba(0,200,255,.12));background:var(--row-alt,rgba(0,0,0,.18))}',
    '#bp-elchip{display:flex;align-items:center;gap:5px;min-width:66px;padding:3px 8px;border-radius:7px;',
    'cursor:pointer;font-family:inherit;font-size:12px;color:var(--text,#e0f0ff);',
    'background:var(--panel-2,rgba(18,26,48,.95));border:1px solid var(--border,rgba(0,200,255,.25))}',
    '#bp-elchip:hover{border-color:var(--accent,#00d4ff)}',
    '#bp-elchip .bp-esym{font-size:15px;font-weight:800;line-height:1}',
    '#bp-elchip .bp-en{font-size:10px;color:var(--muted,#5a7a9a);max-width:104px;overflow:hidden;',
    'text-overflow:ellipsis;white-space:nowrap}',
    '#bp-elsearch{width:132px;padding:4px 7px;border-radius:7px;font-family:inherit;font-size:11px;',
    'color:var(--text,#e0f0ff);background:var(--panel-2,rgba(0,0,0,.3));border:1px solid var(--border,rgba(0,200,255,.2))}',
    '.bp-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#5a7a9a)}',
    '.bp-seg{display:flex;gap:2px}',
    '.bp-seg button{width:26px;height:23px;padding:0;font-size:12px;line-height:1;cursor:pointer;',
    'border-radius:6px;font-family:inherit;border:1px solid var(--border,rgba(0,200,255,.2));',
    'background:var(--panel-2,rgba(18,26,48,.9));color:var(--text,#e0f0ff)}',
    '.bp-seg button.on{background:var(--accent,#00d4ff);color:var(--on-accent,#04121c);border-color:var(--accent,#00d4ff)}',
    '.bp-tg{display:flex;align-items:center;gap:3px;padding:3px 6px;border-radius:6px;cursor:pointer;',
    'font-family:inherit;font-size:10px;border:1px solid var(--border,rgba(0,200,255,.18));',
    'background:transparent;color:var(--muted,#5a7a9a)}',
    '.bp-tg i{width:7px;height:7px;border-radius:2px;background:var(--border,rgba(255,255,255,.16));flex:none}',
    '.bp-tg.on{color:var(--text,#e0f0ff);border-color:var(--accent,#00d4ff)}',
    '.bp-tg.on i{background:var(--accent,#00d4ff);box-shadow:0 0 6px var(--accent-glow,rgba(0,212,255,.6))}',
    '.bp-grow{flex:1 1 auto}',
    '#bp-body{flex:1 1 auto;display:flex;min-height:0}',
    '#bp-rail{flex:none;width:52px;display:flex;flex-direction:column;gap:2px;padding:4px 3px;overflow-y:auto;',
    'border-right:1px solid var(--border,rgba(0,200,255,.12));background:rgba(0,0,0,.14)}',
    '.bp-tool{flex:none;height:26px;padding:0 2px;font-family:inherit;font-size:10px;cursor:pointer;',
    'border-radius:6px;border:1px solid transparent;background:var(--panel-2,rgba(18,26,48,.7));',
    'color:var(--text,#e0f0ff);overflow:hidden;white-space:nowrap}',
    '.bp-tool:hover{border-color:var(--accent,#00d4ff)}',
    '.bp-tool.on{background:var(--accent,#00d4ff);color:var(--on-accent,#04121c);border-color:var(--accent,#00d4ff);font-weight:700}',
    '.bp-rail-div{flex:none;height:1px;margin:3px 2px;background:var(--border,rgba(0,200,255,.14))}',
    '#bp-canvas-wrap{position:relative;flex:1 1 auto;min-width:0;overflow:hidden;background:var(--board,#050912)}',
    '#bp-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;',
    '-webkit-user-select:none;user-select:none}',
    '#bp-elpop{position:absolute;left:6px;top:6px;width:238px;max-height:calc(100% - 12px);display:none;',
    'flex-direction:column;gap:4px;padding:6px;border-radius:10px;z-index:4;',
    'background:var(--overlay,rgba(7,12,24,.97));border:1px solid var(--border,rgba(0,200,255,.25));',
    'box-shadow:var(--panel-shadow,0 8px 26px rgba(0,0,0,.6))}',
    '#bp-elpop.open{display:flex}',
    '#bp-ellist{display:flex;flex-wrap:wrap;gap:3px;overflow-y:auto;min-height:0;max-height:268px;padding:2px}',
    '#bp-ellist button{width:31px;height:26px;border-radius:5px;cursor:pointer;font-family:inherit;',
    'font-size:11px;font-weight:700;border:1px solid var(--border,rgba(255,255,255,.10));background:var(--accent-soft,rgba(255,255,255,.045));',
    'color:var(--text,#e6edf3);padding:0;line-height:1}',
    '#bp-ellist button:hover{border-color:var(--accent,#00d4ff)}',
    '#bp-ellist button.on{outline:2px solid var(--accent,#00d4ff)}',
    '#bp-ellist .bp-empty{width:100%;font-size:10px;color:var(--muted,#5a7a9a);padding:4px}',
    '#bp-zoombtns{position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;gap:3px;z-index:3}',
    '#bp-zoombtns button{width:26px;height:24px;padding:0;font-size:11px;font-family:inherit;cursor:pointer;',
    'border-radius:6px;border:1px solid var(--border,rgba(0,200,255,.22));background:var(--overlay-soft,rgba(7,12,24,.9));',
    'color:var(--text,#e0f0ff)}',
    '#bp-zoombtns button:hover{border-color:var(--accent,#00d4ff)}',
    '#bp-hint{position:absolute;left:8px;bottom:8px;max-width:64%;font-size:10px;line-height:1.35;',
    'color:var(--muted,#5a7a9a);background:var(--overlay-soft,rgba(5,9,18,.82));border:1px solid var(--border,rgba(0,200,255,.14));',
    'border-radius:7px;padding:4px 7px;pointer-events:none;z-index:3}',
    '#bp-io,#bp-helpcard{position:absolute;inset:8px;display:none;flex-direction:column;gap:6px;padding:8px;',
    'border-radius:10px;background:var(--overlay,rgba(6,10,20,.97));border:1px solid var(--border,rgba(0,200,255,.25));z-index:6}',
    '#bp-io.open,#bp-helpcard.open{display:flex}',
    '#bp-io h4,#bp-helpcard h4{margin:0;font-size:12px;color:var(--accent,#00d4ff)}',
    '#bp-io textarea{flex:1 1 auto;min-height:0;resize:none;font-family:ui-monospace,Consolas,monospace;',
    'font-size:11px;line-height:1.4;padding:7px;border-radius:7px;color:var(--text,#c9e6ff);',
    'background:var(--board,#03060c);border:1px solid var(--border,rgba(0,200,255,.2))}',
    '#bp-io .bp-row,#bp-helpcard .bp-row{display:flex;gap:5px;flex-wrap:wrap;flex:none}',
    '#bp-help-body{flex:1 1 auto;min-height:0;overflow-y:auto;font-size:11px;line-height:1.55}',
    '#bp-help-body h5{margin:8px 0 3px;font-size:11px;color:var(--accent,#00d4ff)}',
    '#bp-help-body ul{margin:0;padding-left:16px}',
    '#bp-help-body li{margin:2px 0}',
    '#bp-help-body kbd{font-family:ui-monospace,Consolas,monospace;font-size:10px;padding:1px 4px;',
    'border-radius:4px;background:var(--accent-soft,rgba(255,255,255,.09));border:1px solid var(--border,rgba(255,255,255,.14))}',
    '#bp-ctx{position:absolute;display:none;flex-direction:column;padding:4px;border-radius:8px;z-index:7;',
    'min-width:154px;background:var(--overlay,rgba(7,12,24,.98));border:1px solid var(--border,rgba(0,200,255,.28));',
    'box-shadow:var(--panel-shadow,0 8px 24px rgba(0,0,0,.6))}',
    '#bp-ctx.open{display:flex}',
    '#bp-ctx button{text-align:left;padding:5px 8px;font-family:inherit;font-size:11px;cursor:pointer;',
    'border:none;border-radius:5px;background:transparent;color:var(--text,#e0f0ff)}',
    '#bp-ctx button:hover{background:var(--accent-soft,rgba(0,212,255,.12));color:var(--accent,#00d4ff)}',
    '#bp-foot{flex:none;display:flex;align-items:center;gap:4px;padding:5px 8px;flex-wrap:wrap;',
    'border-top:1px solid var(--border,rgba(0,200,255,.13));background:var(--row-alt,rgba(0,0,0,.2))}',
    '.bp-abtn{padding:4px 7px;font-family:inherit;font-size:11px;cursor:pointer;border-radius:6px;',
    'border:1px solid var(--border,rgba(0,200,255,.2));background:var(--panel-2,rgba(18,26,48,.9));',
    'color:var(--text,#e0f0ff);white-space:nowrap}',
    '.bp-abtn:hover:not(:disabled){border-color:var(--accent,#00d4ff)}',
    '.bp-abtn:disabled{opacity:.4;cursor:default}',
    '.bp-abtn.pr{background:var(--accent,#00d4ff);color:var(--on-accent,#04121c);border-color:var(--accent,#00d4ff);font-weight:700}',
    '.bp-abtn.pr:hover{filter:brightness(1.12)}',
    '#bp-resize{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:5;',
    'touch-action:none;background:linear-gradient(135deg,transparent 45%,var(--accent-glow,rgba(0,212,255,.45)) 46%,',
    'transparent 52%,var(--accent-glow,rgba(0,212,255,.45)) 60%,transparent 66%)}',
    '#bp-panel.min #bp-elbar,#bp-panel.min #bp-body,#bp-panel.min #bp-foot,#bp-panel.min #bp-resize{display:none}',
    '#bp-panel.min{height:auto !important;min-height:0}',
    '.bp-chip{padding:2px 6px;border-radius:5px;background:var(--warn-soft,rgba(255,170,0,.12));color:var(--warn,#ffaa00);',
    'border:1px solid var(--warn,rgba(255,170,0,.3));font-size:10px}',
    '.bp-chip.err{background:var(--err-soft,rgba(255,80,110,.14));color:var(--err-text,#ff6b84);border-color:var(--err,rgba(255,80,110,.4))}',
    '.bp-lc{width:1em;height:1em;vertical-align:-0.18em;margin-right:3px;stroke-width:2.4}',
    /* Small screens and landscape phones: a full-width sheet that docks under the',
       top bar so the pool strip and the action bar keep working. */
    '@media (max-width:780px),(max-height:640px){',
    '#bp-panel{left:3px !important;right:3px;top:42px !important;width:auto !important;',
    'height:min(64%,430px) !important}',
    '#bp-head{cursor:default}',
    '#bp-rail{width:44px}',
    '.bp-tool{font-size:9px;height:24px}',
    '#bp-elsearch{width:96px}',
    '#bp-elbar{gap:4px;padding:4px 6px}',
    '#bp-foot{gap:3px;padding:4px 6px}',
    '.bp-abtn{padding:3px 5px;font-size:10px}',
    '#bp-elpop{width:calc(100% - 12px)}',
    '#bp-ellist{max-height:38vh}',
    '#bp-hint{display:none}}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Short button captions; the long strings above stay as tooltips.
  var SHORT = {
    en: { sUndo: 'Undo', sRedo: 'Redo', sCopy: 'Copy', sCut: 'Cut', sPaste: 'Paste', sAll: 'All',
      sDel: 'Delete', sAddH: 'Add H', sClean: 'Clean', sFit: 'Fit', s3D: 'Build 3D', sSel: 'sel',
      sAtom: 'atom', sBond: 'bond', sPan: 'pan', sErase: 'erase', sGrid: 'grid', sH: 'H', sQ: 'charge',
      sLP: 'lone e', sBohr: 'Bohr', sOrder: 'bond', sEl: 'Element', sZoom: 'zoom', sOk: 'done' },
    vi: { sUndo: 'Hoàn tác', sRedo: 'Làm lại', sCopy: 'Sao chép', sCut: 'Cắt', sPaste: 'Dán',
      sAll: 'Chọn hết', sDel: 'Xoá', sAddH: 'Thêm H', sClean: 'Dọn layout', sFit: 'Vừa khung',
      s3D: 'Dựng 3D', sSel: 'chọn', sAtom: 'ng.tử', sBond: 'lkết', sPan: 'kéo', sErase: 'tẩy',
      sGrid: 'lưới', sH: 'H', sQ: 'điện tích', sLP: 'e tự do', sBohr: 'Bohr', sOrder: 'bậc',
      sEl: 'Nguyên tố', sZoom: 'phóng', sOk: 'xong' }
  };
  (function mergeShort() {
    for (var k in SHORT.en) {
      if (Object.prototype.hasOwnProperty.call(SHORT.en, k)) {
        STR.en[k] = SHORT.en[k];
        STR.vi[k] = SHORT.vi[k] || SHORT.en[k];
      }
    }
  })();

  var TOOLS = [
    { id: 'select', lbl: 'sSel', str: 'tSelect' },
    { id: 'atom', lbl: 'sAtom', str: 'tAtom' },
    { id: 'bond', lbl: 'sBond', str: 'tBond' },
    { div: true },
    { id: 'charge-p', lbl: 'q+', str: 'tChargeP' },
    { id: 'charge-m', lbl: 'q−', str: 'tChargeM' },
    { id: 'lp-p', lbl: 'lp+', str: 'tLpP' },
    { id: 'lp-m', lbl: 'lp−', str: 'tLpM' },
    { id: 'bracket', lbl: '[ ]', str: 'tBracket' },
    { div: true },
    { id: 'erase', lbl: 'sErase', str: 'tErase' },
    { id: 'pan', lbl: 'sPan', str: 'tPan' }
  ];

  function buildPanel() {
    var p = document.createElement('div');
    p.id = 'bp-panel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'Blueprint');

    var head = '<div id="bp-head"><span id="bp-badge">2D</span><span id="bp-title"></span>' +
      '<span id="bp-readout"></span>' +
      '<button type="button" class="bp-hbtn" id="bp-min" aria-label="minimize">&#8211;</button>' +
      '<button type="button" class="bp-hbtn" id="bp-help" aria-label="help">?</button>' +
      '<button type="button" class="bp-hbtn" id="bp-close" aria-label="close">&#10005;</button></div>';

    var elbar = '<div id="bp-elbar">' +
      '<button type="button" id="bp-elchip"><span class="bp-esym">C</span><span class="bp-en"></span></button>' +
      '<input id="bp-elsearch" type="search" autocomplete="off" spellcheck="false" />' +
      '<span class="bp-sep bp-lbl" id="bp-orderlbl"></span>' +
      '<span class="bp-seg" id="bp-orders">' +
      '<button type="button" data-o="1">&#8212;</button>' +
      '<button type="button" data-o="2">=</button>' +
      '<button type="button" data-o="3">&#8801;</button></span>' +
      '<span class="bp-grow"></span>' +
      '<button type="button" class="bp-tg" data-tg="grid"><i></i><span></span></button>' +
      '<button type="button" class="bp-tg" data-tg="showH"><i></i><span></span></button>' +
      '<button type="button" class="bp-tg" data-tg="showQ"><i></i><span></span></button>' +
      '<button type="button" class="bp-tg" data-tg="showLP"><i></i><span></span></button>' +
      '<button type="button" class="bp-tg" data-tg="shells"><i></i><span></span></button>' +
      '<button type="button" class="bp-tg" data-tg="vsepr"><i></i><span></span></button>' +
      '</div>';

    var body = '<div id="bp-body"><div id="bp-rail"></div>' +
      '<div id="bp-canvas-wrap"><canvas id="bp-canvas"></canvas>' +
      '<div id="bp-elpop"><div id="bp-ellist"></div></div>' +
      '<div id="bp-zoombtns"><button type="button" data-z="in">+</button>' +
      '<button type="button" data-z="fit">&#8862;</button>' +
      '<button type="button" data-z="out">&#8211;</button></div>' +
      '<div id="bp-hint"></div>' +
      '<div id="bp-ctx"></div>' +
      '<div id="bp-io"><h4></h4><textarea readonly spellcheck="false"></textarea>' +
      '<div class="bp-row"><button type="button" class="bp-abtn" data-io="copy"></button>' +
      '<button type="button" class="bp-abtn" data-io="save"></button>' +
      '<span class="bp-grow"></span>' +
      '<button type="button" class="bp-abtn" data-io="close"></button></div></div>' +
      '<div id="bp-helpcard"><h4></h4><div id="bp-help-body"></div>' +
      '<div class="bp-row"><span class="bp-grow"></span>' +
      '<button type="button" class="bp-abtn" data-help="close"></button></div></div>' +
      '</div></div>';

    var foot = '<div id="bp-foot">' +
      '<button type="button" class="bp-abtn" data-act="undo"></button>' +
      '<button type="button" class="bp-abtn" data-act="redo"></button>' +
      '<button type="button" class="bp-abtn" data-act="copy"></button>' +
      '<button type="button" class="bp-abtn" data-act="cut"></button>' +
      '<button type="button" class="bp-abtn" data-act="paste"></button>' +
      '<button type="button" class="bp-abtn" data-act="all"></button>' +
      '<button type="button" class="bp-abtn" data-act="del"></button>' +
      '<span class="bp-grow"></span>' +
      '<button type="button" class="bp-abtn" data-act="addH"></button>' +
      '<button type="button" class="bp-abtn" data-act="clean"></button>' +
      '<button type="button" class="bp-abtn" data-act="fit"></button>' +
      '<span class="bp-grow"></span>' +
      '<button type="button" class="bp-abtn pr" data-act="to3d"></button>' +
      '<button type="button" class="bp-abtn" data-act="png"></button>' +
      '<button type="button" class="bp-abtn" data-act="mol"></button>' +
      '<button type="button" class="bp-abtn" data-act="smiles"></button>' +
      '</div><div id="bp-resize" title="resize"></div>';

    p.innerHTML = head + elbar + body + foot;
    document.body.appendChild(p);

    var q = function (id) { return p.querySelector(id); };
    els.panel = p;
    els.head = q('#bp-head');
    els.title = q('#bp-title');
    els.readout = q('#bp-readout');
    els.min = q('#bp-min');
    els.help = q('#bp-help');
    els.close = q('#bp-close');
    els.elchip = q('#bp-elchip');
    els.elSym = q('#bp-elchip .bp-esym');
    els.elName = q('#bp-elchip .bp-en');
    els.elSearch = q('#bp-elsearch');
    els.orderLbl = q('#bp-orderlbl');
    els.orders = q('#bp-orders');
    els.rail = q('#bp-rail');
    els.canvasWrap = q('#bp-canvas-wrap');
    els.canvas = q('#bp-canvas');
    els.elpop = q('#bp-elpop');
    els.ellist = q('#bp-ellist');
    els.zoomBtns = q('#bp-zoombtns');
    els.hint = q('#bp-hint');
    els.ctx = q('#bp-ctx');
    els.io = q('#bp-io');
    els.ioTitle = q('#bp-io h4');
    els.ioText = q('#bp-io textarea');
    els.helpCard = q('#bp-helpcard');
    els.helpTitle = q('#bp-helpcard h4');
    els.helpBody = q('#bp-help-body');
    els.foot = q('#bp-foot');
    els.resize = q('#bp-resize');

    var railHtml = '';
    for (var i = 0; i < TOOLS.length; i++) {
      if (TOOLS[i].div) { railHtml += '<div class="bp-rail-div"></div>'; continue; }
      railHtml += '<button type="button" class="bp-tool" data-tool="' + TOOLS[i].id + '"></button>';
    }
    els.rail.innerHTML = railHtml;
  }

  function $(act) { return els.foot.querySelector('[data-act="' + act + '"]'); }

  // ==========================================================================
  // 5. History + persistence. One snapshot per user action.
  // ==========================================================================
  function snapshot() {
    return JSON.stringify({ a: doc.atoms, b: doc.bonds, k: doc.brackets, n: doc.nextId });
  }
  function applySnapshot(json) {
    var s;
    try { s = JSON.parse(json); } catch (e) { return false; }
    if (!s || !Array.isArray(s.a)) return false;
    doc.atoms = s.a;
    doc.bonds = (s.b || []).filter(function (x) { return x && x.a && x.b; });
    doc.brackets = Array.isArray(s.k) ? s.k : [];
    doc.nextId = s.n || (doc.atoms.length + doc.bonds.length + 1);
    var alive = {};
    for (var i = 0; i < doc.atoms.length; i++) alive[doc.atoms[i].id] = 1;
    doc.bonds = doc.bonds.filter(function (x) { return alive[x.a] && alive[x.b]; });
    ui.sel = ui.sel.filter(function (id) { return alive[id]; });
    ui.rev++;
    return true;
  }
  function beforeChange() {
    ui.hist.push(ui.cur);
    if (ui.hist.length > HISTORY_MAX) ui.hist.shift();
    ui.future.length = 0;
  }
  function afterChange() {
    ui.rev++;
    ui.cur = snapshot();
    scheduleSave();
    refresh();
  }
  function undo() {
    if (!ui.hist.length) { toast(tx('nothingUndo'), 'err'); return; }
    ui.future.push(ui.cur);
    ui.cur = ui.hist.pop();
    applySnapshot(ui.cur);
    scheduleSave();
    refresh();
    toast(tx('undoDone'), 'ok');
  }
  function redo() {
    if (!ui.future.length) { toast(tx('nothingRedo'), 'err'); return; }
    ui.hist.push(ui.cur);
    ui.cur = ui.future.pop();
    applySnapshot(ui.cur);
    scheduleSave();
    refresh();
    toast(tx('redoDone'), 'ok');
  }

  function saveAll() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        doc: JSON.parse(ui.cur), ui: {
          zoom: ui.zoom, pan: ui.pan, el: ui.el, tool: ui.tool, bond: ui.bond,
          grid: ui.grid, snap: ui.snap, showH: ui.showH, showQ: ui.showQ, showLP: ui.showLP,
          shells: ui.shells, vsepr: ui.vsepr, left: els.panel.style.left, top: els.panel.style.top,
          w: els.panel.style.width, h: els.panel.style.height
        }
      }));
    } catch (e) { /* a full or blocked storage must never break the editor */ }
  }
  function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveAll, 400);
  }
  function loadAll() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
    if (!raw) return;
    var s;
    try { s = JSON.parse(raw); } catch (e) { return; }
    if (s && s.doc) {
      doc.atoms = s.doc.a || [];
      doc.bonds = s.doc.b || [];
      doc.brackets = s.doc.k || [];
      doc.nextId = s.doc.n || 1;
    }
    var u = s && s.ui ? s.ui : {};
    if (typeof u.zoom === 'number' && isFinite(u.zoom)) ui.zoom = Math.min(4, Math.max(0.2, u.zoom));
    if (u.pan && isFinite(u.pan.x) && isFinite(u.pan.y)) ui.pan = { x: u.pan.x, y: u.pan.y };
    if (u.el && BY_SYM[u.el]) ui.el = u.el;
    if (u.tool) ui.tool = u.tool;
    if (u.bond) ui.bond = u.bond;
    ['grid', 'snap', 'showH', 'showQ', 'showLP', 'shells', 'vsepr'].forEach(function (k) {
      if (typeof u[k] === 'boolean') ui[k] = u[k];
    });
    if (u.left && u.top) {
      els.panel.style.left = u.left;
      els.panel.style.top = u.top;
      els.panel.dataset.placed = '1';
    }
    if (u.w && u.h) { els.panel.style.width = u.w; els.panel.style.height = u.h; }
    ui.cur = snapshot();
  }

  // ==========================================================================
  // 6. Model operations.
  // ==========================================================================
  function snapPoint(x, y) {
    if (!ui.snap) return { x: x, y: y };
    return { x: Math.round(x / (GRID / 2)) * (GRID / 2), y: Math.round(y / (GRID / 2)) * (GRID / 2) };
  }
  function atomNear(x, y, r) {
    r = r || 12;
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      if (Math.abs(a.x - x) < r && Math.abs(a.y - y) < r) return a;
    }
    return null;
  }
  function freeSpotNear(x, y) {
    var tries = 0;
    while (atomNear(x, y, 15) && tries < 24) {
      var ang = tries * 1.1;
      var rad = 16 + tries * 9;
      var p = snapPoint(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
      x = p.x; y = p.y;
      tries++;
    }
    return { x: x, y: y };
  }
  function makeAtom(sym, x, y) {
    var a = { id: newId(), sym: sym, x: x, y: y, q: 0, lp: 0 };
    doc.atoms.push(a);
    return a;
  }
  function removeAtom(id) {
    var n = 0;
    doc.bonds = doc.bonds.filter(function (b) {
      if (b.a === id || b.b === id) { n++; return false; }
      return true;
    });
    doc.atoms = doc.atoms.filter(function (a) { return a.id !== id; });
    ui.sel = ui.sel.filter(function (s) { return s !== id; });
    return n;
  }
  function removeBond(id) {
    doc.bonds = doc.bonds.filter(function (b) { return b.id !== id; });
  }
  function addBond(aId, bId, order, ionic) {
    var b = { id: newId(), a: aId, b: bId, order: order, ionic: !!ionic };
    doc.bonds.push(b);
    return b;
  }

  function setTool(t) {
    var found = false;
    for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === t) found = true;
    if (!found) return;
    ui.tool = t;
    syncButtons();
    syncCursor();
    scheduleSave();
  }
  function setElement(sym) {
    var el = elOf(sym);
    if (!el) { toast(tx('unknownEl', { sym: sym }), 'err'); return false; }
    ui.el = sym;
    if (ui.tool !== 'atom' && ui.tool !== 'bond') ui.tool = 'atom';
    syncButtons();
    scheduleSave();
    return true;
  }
  function setBondOrder(n) {
    ui.bond = n;
    syncButtons();
    scheduleSave();
    toast(tx('bondOrderSet', { n: n }), 'info');
  }
  function selectOnly(id, add) {
    if (id === null) { ui.sel = []; syncHint(); return; }
    if (add) {
      var k = ui.sel.indexOf(id);
      if (k >= 0) ui.sel.splice(k, 1); else ui.sel.push(id);
    } else {
      ui.sel = [id];
    }
    syncHint();
  }
  function clearSel() { ui.sel = []; syncHint(); }
  function selAtoms() {
    var out = [];
    for (var i = 0; i < ui.sel.length; i++) {
      var a = atomById(ui.sel[i]);
      if (a) out.push(a);
    }
    return out;
  }

  // ---- drawing actions ---------------------------------------------------
  // An atom does not go where the mouse stopped; it goes on a joint. The joint set
  // is the free VSEPR direction of the atoms already on the board, at the distance
  // the scene would use for that pair, and each one has been through the rules
  // before it is offered. Alt is the one deliberate escape hatch, for parking a
  // fragment in empty space; near a structure there is no free position.
  function actPlaceAtom(x, y, free) {
    if (!free && ui.vsepr) {
      var js = jointsNear(x, y, ui.el, ui.bond);
      if (js.length) return placeFromJoint(js[0]);
    }
    var p = snapPoint(x, y);
    var f = freeSpotNear(p.x, p.y);
    beforeChange();
    var a = makeAtom(ui.el, f.x, f.y);
    afterChange();
    toast(tx('placed', { sym: a.sym }), 'ok');
    return a;
  }
  // A centre that is still allowed to grow keeps joints at positions its shape of
  // the moment has not moved out of yet, so the spot a neighbour occupies can be
  // one of them. Clicking there with the atom tool asks for one more atom in that
  // direction, not for a paint of the atom already sitting on it: the joint set is
  // consulted and a joint owned by a different atom than the one hit wins.
  function jointUnderAtom(x, y, sym, hitId) {
    if (!ui.vsepr) return null;
    var js = jointsNear(x, y, sym, ui.bond);
    for (var i = 0; i < js.length; i++) {
      if (js[i].parent !== hitId) return js[i];
    }
    return null;
  }
  // Drop the current element onto a joint and join it to the atom that owns it.
  function placeFromJoint(j) {
    var parent = atomById(j.parent);
    if (!parent) return null;
    beforeChange();
    var a = makeAtom(ui.el, j.x, j.y);
    var b = addBond(j.parent, a.id, j.order, j.ionic);
    // The joint was computed for the atom as it stood before this bond. Once the
    // bond exists the parent may have fewer domains left to fill — a carbon that
    // was one double bond short of sp3 is sp after the second — so the piece is
    // settled onto the model instead of keeping the shape of an unfinished atom.
    settleAround(a.id, j.parent);
    afterChange();
    bondToast(parent, a, b, false,
      (j.short ? trReason(j.reason) + ' ' : '') + tx(j.kind === 'lp' ? 'jointLp' : 'placedJoint',
        { sym: a.sym, a: parent.sym }));
    return a;
  }
  // The joint of `parent` that a drag heading in direction `ang` is asking for.
  function jointByAngle(parentId, sym, order, ang) {
    var js = jointsOf(parentId, sym, order), best = null, bs = Infinity;
    for (var i = 0; i < js.length; i++) {
      var s = angDist(js[i].ang, ang) + (js[i].kind === 'lp' ? 0.6 : 0);
      if (s < bs) { bs = s; best = js[i]; }
    }
    return best;
  }
  function actBond(aId, bId, wantOrder) {
    if (aId === bId) return;
    var A = atomById(aId), B = atomById(bId);
    if (!A || !B) return;
    var order = Math.max(1, wantOrder || ui.bond);
    var ex = bondBetween(aId, bId);
    if (ex) {
      if (order === ex.order) {
        beforeChange();
        removeBond(ex.id);
        // Cutting one line of a ring opens it; the piece is then allowed to take
        // the shape an open chain has rather than keeping a hexagon it no longer
        // is. An unordered click does not cut, so nothing moves.
        if (ringOpened(A, B)) settleAround(aId);
        afterChange();
        toast(tx('bondCut'), 'info');
        return;
      }
      if (order < ex.order) {
        beforeChange();
        ex.order = order;
        settleAround(aId);
        afterChange();
        toast(tx('bondLower', { n: order }), 'ok');
        return;
      }
      var up = raisePlan(ex, order);
      if (up.order <= ex.order) {
        toast(trReason(up.reason) || tx('bondNoRaise'), 'err');
        return;
      }
      beforeChange();
      ex.order = up.order;
      settleAround(aId);
      afterChange();
      bondToast(A, B, ex, false, up.order < order ? trReason(up.reason) : null);
      return;
    }
    // The game decides whether these two atoms may be joined at all, and how
    // strongly. A refused pair is reported with the game's own sentence.
    var plan = bondPlan(aId, bId, order);
    if (!plan.ok) { toast(trReason(plan.reason), 'err'); return; }
    // Two atoms that already share a path do not fuse fragments — the new bond
    // closes a ring, which is how cyclohexane and benzene get drawn.
    var closesRing = connected(aId, bId);
    beforeChange();
    var nb = addBond(aId, bId, plan.order, plan.type === 'ionic');
    // Joining two atoms that were each placed by their own structure means the
    // piece has to reconcile both: it settles into one set of VSEPR angles.
    if (closesRing || Math.hypot(A.x - B.x, A.y - B.y) > 1) settleAround(aId);
    afterChange();
    bondToast(A, B, nb, closesRing, plan.short ? trReason(plan.reason) : null);
  }
  // Whether a bond that has just been cut belonged to a ring: if the two atoms
  // are still reachable one way round, the cut opened the ring instead of
  // splitting the piece.
  function ringOpened(A, B) {
    return !!A && !!B && connected(A.id, B.id);
  }
  function bondToast(A, B, bond, closesRing, note) {
    var msg = bond.ionic
      ? tx('bondIonic', { a: A.sym, b: B.sym })
      : tx('bondMade', { a: A.sym, o: ordGlyph(bond.order), b: B.sym });
    if (closesRing) msg += ' · ' + tx('ringClosed');
    if (note) msg += ' — ' + note;
    toast(msg, 'ok');
  }
  // Bond tool dragged from an atom out over empty canvas: the far end becomes a new
  // atom of the current element, but only if the game would join them. Where it
  // lands is the structure's decision — the free joint the drag points at.
  function actBondToNew(fromId, x, y, wantOrder) {
    var from = atomById(fromId);
    if (!from) return null;
    var order = Math.max(1, wantOrder || ui.bond);
    if (ui.vsepr) {
      var jt = jointByAngle(fromId, ui.el, order, Math.atan2(y - from.y, x - from.x));
      if (jt) return placeFromJoint(jt);
    }
    var probe = { id: '~probe', sym: ui.el, x: 0, y: 0, q: 0, lp: 0 };
    var plan = probePlan([probe], fromId, probe.id, order);
    if (!plan.ok) { toast(trReason(plan.reason), 'err'); return null; }
    var len = lengthPx(from.sym, ui.el, plan.type === 'ionic');
    var ang = Math.atan2(y - from.y, x - from.x);
    var f = ui.vsepr ? { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len } :
      freeSpotNear(snapPoint(x, y).x, snapPoint(x, y).y);
    if (blockedAt(f.x, f.y, from.id, len)) f = freeSpotNear(f.x, f.y);
    beforeChange();
    var na = makeAtom(ui.el, f.x, f.y);
    var nb = addBond(fromId, na.id, plan.order, plan.type === 'ionic');
    afterChange();
    bondToast(from, na, nb, false, plan.short ? trReason(plan.reason) : null);
    return na;
  }
  // Bond tool dragged across empty canvas: both ends are new atoms (or one new and
  // one already on the board), joined only if the rules approve the pair.
  function actNewBondDrag(x0, y0, x1, y1, endHit, wantOrder) {
    var order = Math.max(1, wantOrder || ui.bond);
    var intoExisting = !!endHit;
    var PA = { id: '~probeA', sym: ui.el, x: 0, y: 0, q: 0, lp: 0 };
    var PB = intoExisting ? endHit : { id: '~probeB', sym: ui.el, x: 0, y: 0, q: 0, lp: 0 };
    var probes = intoExisting ? [PA] : [PA, PB];
    var plan = probePlan(probes, PA.id, PB.id, order);
    if (!plan.ok) { toast(trReason(plan.reason), 'err'); return; }
    // The first end is placed like any other atom: on a joint of whatever is close
    // enough to hold it, and only out in free space when nothing is.
    var start = null;
    if (ui.vsepr) {
      var js = jointsNear(x0, y0, ui.el, order);
      if (js.length) start = js[0];
    }
    var a0 = snapPoint(x0, y0), f0 = freeSpotNear(a0.x, a0.y);
    beforeChange();
    var A0 = start ? makeAtom(ui.el, start.x, start.y) : makeAtom(ui.el, f0.x, f0.y);
    if (start) addBond(start.parent, A0.id, start.order, start.ionic);
    var B0 = intoExisting ? atomById(endHit.id) : null;
    if (!B0) {
      var len = lengthPx(A0.sym, ui.el, plan.type === 'ionic');
      var f1;
      if (ui.vsepr) {
        var jb = jointByAngle(A0.id, ui.el, order, Math.atan2(y1 - A0.y, x1 - A0.x));
        f1 = jb ? { x: jb.x, y: jb.y } :
          { x: A0.x + Math.cos(Math.atan2(y1 - A0.y, x1 - A0.x)) * len, y: A0.y + Math.sin(Math.atan2(y1 - A0.y, x1 - A0.x)) * len };
        if (blockedAt(f1.x, f1.y, A0.id, len)) f1 = freeSpotNear(f1.x, f1.y);
      } else {
        f1 = freeSpotNear(snapPoint(x1, y1).x, snapPoint(x1, y1).y);
      }
      B0 = makeAtom(ui.el, f1.x, f1.y);
    }
    var nb = addBond(A0.id, B0.id, plan.order, plan.type === 'ionic');
    afterChange();
    bondToast(A0, B0, nb, false, plan.short ? trReason(plan.reason) : null);
  }
  function connected(aId, bId) {
    // true when a path already joins the two atoms (so a new bond closes a ring)
    var seen = {}, stack = [aId];
    seen[aId] = 1;
    while (stack.length) {
      var id = stack.pop();
      if (id === bId) return true;
      var bs = bondsOf(id);
      for (var i = 0; i < bs.length; i++) {
        var o = bs[i].a === id ? bs[i].b : bs[i].a;
        if (!seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    return false;
  }
  function ordGlyph(n) { return n === 1 ? '—' : n === 2 ? '=' : n === 3 ? '≡' : String(n); }
  function actCycleBondDown(bond) {
    beforeChange();
    if (bond.order <= 1) {
      removeBond(bond.id);
      toast(tx('bondCut'), 'info');
    } else {
      bond.order -= 1;
      toast(tx('bondLower', { n: bond.order }), 'ok');
    }
    afterChange();
  }
  function actCycleBondUp(bond) {
    var up = raisePlan(bond, Math.max(1, bond.order || 1) + 1);
    if (!up.ok) {
      toast(trReason(up.reason) || tx('bondNoRaise', { n: headroom(bond) }), 'err');
      return;
    }
    beforeChange();
    bond.order = up.order;
    afterChange();
    var A = atomById(bond.a), B = atomById(bond.b);
    toast(tx('bondOrderSet', { n: bond.order }) +
      (A && B ? ' · ' + A.sym + ordGlyph(bond.order) + B.sym : ''), 'ok');
  }
  function actCharge(id, delta) {
    var a = atomById(id);
    if (!a) return;
    beforeChange();
    a.q = Math.max(-8, Math.min(8, (a.q || 0) + delta));
    afterChange();
    toast(tx('chargeSet', { sym: a.sym, q: signed(a.q) }), 'ok');
  }
  function signed(q) {
    if (!q) return '0';
    var m = Math.abs(q) === 1 ? '' : String(Math.abs(q));
    return q > 0 ? '+' + m : '−' + m;
  }
  function actLonePair(id, delta) {
    var a = atomById(id);
    if (!a) return;
    var cur = lpCount(a);
    if (delta < 0 && cur <= 0) { toast(tx('lpNone'), 'err'); return; }
    beforeChange();
    var n = setLP(a, cur + delta);
    afterChange();
    toast(tx('lpSet', { sym: a.sym, n: n }), 'ok');
  }
  function actEraseAt(id, bondHit) {
    beforeChange();
    if (id !== null) {
      var a = atomById(id);
      var n = removeAtom(id);
      afterChange();
      toast(tx('erasedAtom', { sym: a ? a.sym : '?' }) + (n ? ' (' + tx('erasedBonds', { n: n }) + ')' : ''), 'ok');
      return;
    }
    if (bondHit) {
      removeBond(bondHit.id);
      afterChange();
      toast(tx('bondCut'), 'ok');
      return;
    }
    afterChange();
    ui.hist.pop();
    toast(tx('nothingErase'), 'err');
  }
  function actBracket() {
    var ids = ui.sel.slice();
    if (ids.length < 2) {
      if (!ids.length) { toast(tx('nothingSel'), 'err'); return; }
      var comp = null, comps = components();
      for (var i = 0; i < comps.length; i++) {
        if (comps[i].indexOf(ids[0]) >= 0) { comp = comps[i]; break; }
      }
      if (!comp) return;
      ids = comp;
    }
    ids = ids.slice().sort(function (x, y) { return x - y; });
    var key = ids.join(',');
    var at = -1;
    for (var j = 0; j < doc.brackets.length; j++) if (doc.brackets[j].key === key) at = j;
    beforeChange();
    if (at >= 0) {
      doc.brackets.splice(at, 1);
      afterChange();
      toast(tx('bracketDel'), 'info');
      return;
    }
    doc.brackets.push({ key: key, ids: ids, q: netCharge(ids) });
    afterChange();
    toast(tx('bracketAdd', { n: ids.length }), 'ok');
  }
  function actDeleteSel() {
    if (!ui.sel.length) { toast(tx('nothingSel'), 'err'); return; }
    beforeChange();
    var n = 0;
    var list = ui.sel.slice();
    for (var i = 0; i < list.length; i++) { if (atomById(list[i])) { removeAtom(list[i]); n++; } }
    afterChange();
    toast(tx('deleted', { n: n }), 'ok');
  }
  function copyPayload(ids) {
    var alive = {};
    for (var i = 0; i < ids.length; i++) alive[ids[i]] = 1;
    var atoms = [];
    for (var j = 0; j < doc.atoms.length; j++) {
      var a = doc.atoms[j];
      if (alive[a.id]) atoms.push({ id: a.id, sym: a.sym, x: a.x, y: a.y, q: a.q || 0, lp: a.lp || 0, lpSet: a.lpSet ? 1 : 0 });
    }
    var bonds = [];
    for (var k = 0; k < doc.bonds.length; k++) {
      var b = doc.bonds[k];
      if (alive[b.a] && alive[b.b]) bonds.push({ id: b.id, a: b.a, b: b.b, order: b.order, ionic: !!b.ionic });
    }
    return { atoms: atoms, bonds: bonds };
  }
  function actCopy() {
    var ids = ui.sel.slice();
    if (!ids.length) { toast(tx('nothingSel'), 'err'); return false; }
    ui.clip = copyPayload(ids);
    toast(tx('copied', { n: ids.length }), 'ok');
    return true;
  }
  function actCut() {
    var ids = ui.sel.slice();
    if (!ids.length) { toast(tx('nothingSel'), 'err'); return false; }
    ui.clip = copyPayload(ids);
    beforeChange();
    for (var i = 0; i < ids.length; i++) removeAtom(ids[i]);
    afterChange();
    toast(tx('copied', { n: ids.length }), 'ok');
    return true;
  }
  function actPaste(off) {
    if (!ui.clip || !ui.clip.atoms.length) { toast(tx('nothingPaste'), 'err'); return; }
    var map = {};
    var dx = off && typeof off.x === 'number' ? off.x : GRID;
    var dy = off && typeof off.y === 'number' ? off.y : GRID;
    beforeChange();
    var created = [], shift = null;
    for (var i = 0; i < ui.clip.atoms.length; i++) {
      var s = ui.clip.atoms[i];
      // The clipboard is one piece: only its first atom is snapped to the grid and
      // the rest follow, otherwise a copy of a joint-built molecule would arrive
      // with every bond length nudged a little.
      if (!shift) {
        var p0 = snapPoint(s.x + dx, s.y + dy);
        shift = { x: p0.x - (s.x + dx), y: p0.y - (s.y + dy) };
      }
      var a = makeAtom(s.sym, s.x + dx + shift.x, s.y + dy + shift.y);
      a.q = s.q || 0;
      a.lp = s.lp || 0;
      a.lpSet = s.lpSet ? 1 : 0;
      map[s.id] = a.id;
      created.push(a.id);
    }
    var refused = 0;
    for (var j = 0; j < ui.clip.bonds.length; j++) {
      var b = ui.clip.bonds[j];
      if (!map[b.a] || !map[b.b]) continue;
      // A clipboard can predate the rules (or carry a bond the rules dislike once it
      // lands among new neighbours), so every pasted line is asked again.
      var plan = bondPlan(map[b.a], map[b.b], Math.max(1, b.order || 1));
      if (!plan.ok) { refused++; continue; }
      addBond(map[b.a], map[b.b], plan.order, plan.type === 'ionic');
    }
    if (ui.vsepr) applyDock(created);
    ui.sel = created;
    afterChange();
    toast(tx('pasted', { n: created.length }), 'ok');
    if (refused) toast(tx('pasteSkipped', { n: refused }), 'err');
  }
  function actAddHydrogens() {
    var adds = [], refused = 0, why = null;
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      if (a.sym === 'H') continue;
      var el = elOf(a.sym);
      if (!el) continue;
      // Only shared pairs spend valence; an ionic neighbour already paid in electrons.
      var need = implicitH(a);
      if (need <= 0) continue;
      if (ui.vsepr) {
        // The joints of this atom are exactly the positions its electron domains
        // leave free, so filling the open valences becomes the same operation the
        // drawing tools do instead of a second, differently-shaped rule.
        var js = jointsOf(a.id, 'H', 1), got = 0;
        for (var jj2 = 0; jj2 < js.length && got < need; jj2++) {
          adds.push({ parent: a.id, x: js[jj2].x, y: js[jj2].y });
          got++;
        }
        if (got < need) {
          refused += need - got;
          why = why || tx('jointNone', { a: a.sym });
        }
        continue;
      }
      var dirs = [];
      var bs = bondsOf(a.id);
      for (var j = 0; j < bs.length; j++) {
        var o = atomById(bs[j].a === a.id ? bs[j].b : bs[j].a);
        if (!o) continue;
        var vx = o.x - a.x, vy = o.y - a.y;
        var L = Math.hypot(vx, vy) || 1;
        dirs.push(Math.atan2(vy / L, vx / L));
      }
      for (var k = 0; k < need; k++) {
        var ang;
        if (!dirs.length) ang = (k / need) * Math.PI * 2 - Math.PI / 2;
        else if (dirs.length === 1) ang = dirs[0] + Math.PI + (need === 1 ? 0 : (k - (need - 1) / 2) * (2.03 / Math.max(1, need - 1)));
        else ang = (k / need) * Math.PI * 2 + 0.4;
        var probe = { id: '~probeH', sym: 'H', x: 0, y: 0, q: 0, lp: 0 };
        var hp = probePlan([probe], a.id, probe.id, 1);
        if (!hp.ok) { refused++; why = why || trReason(hp.reason); continue; }
        adds.push({
          parent: a.id,
          x: a.x + Math.cos(ang) * BOND_LEN,
          y: a.y + Math.sin(ang) * BOND_LEN
        });
      }
    }
    if (!adds.length) {
      if (refused) { toast(tx('hRefused', { n: refused }) + (why ? ' — ' + why : ''), 'err'); return; }
      var stray = 0;
      for (var m = 0; m < doc.atoms.length; m++) {
        var at = doc.atoms[m];
        if (at.sym !== 'H' && !bondsOf(at.id).length) stray++;
      }
      toast(stray ? tx('hBlocked', { n: stray }) : tx('hNone'), stray ? 'err' : 'info');
      return;
    }
    beforeChange();
    for (var n = 0; n < adds.length; n++) {
      var s2 = adds[n];
      var p2 = freeSpotNear(s2.x, s2.y);
      var h = makeAtom('H', p2.x, p2.y);
      addBond(s2.parent, h.id, 1, false);
    }
    afterChange();
    toast(tx('hAdded', { n: adds.length }) + (refused ? ' — ' + tx('hRefused', { n: refused }) : ''), 'ok');
  }

  // ---- clean layout ------------------------------------------------------
  // Two standards, and the VSEPR toggle picks between them. With geometry on the
  // layout is the same model the joints are drawn from: the electron domains of
  // each centre fix its directions, the scene's own ball-to-ball measure fixes
  // each bond's length, and a relaxation then closes the rings that a tree walk
  // can only leave open. With it off this is the classic drawing rule - one bond
  // length, 120-degree zig-zag chains, regular polygons for rings.
  function actCleanLayout() {
    if (!doc.atoms.length) { toast(tx('emptyDoc'), 'err'); return; }
    beforeChange();
    layoutDoc();
    afterChange();
    actFit();
    toast(tx('laidOut'), 'ok');
  }
  function layoutDoc() {
    var comps = components();
    var i;
    for (i = 0; i < comps.length; i++) seedComponent(comps[i]);
    for (i = 0; i < comps.length; i++) relaxComponent(comps[i]);
    stackFragments(comps);
    for (i = 0; i < doc.atoms.length; i++) {
      doc.atoms[i].x = Math.round(doc.atoms[i].x * 4) / 4;
      doc.atoms[i].y = Math.round(doc.atoms[i].y * 4) / 4;
    }
  }
  function kidsOf(id, parent, seen) {
    var out = [], bs = bondsOf(id);
    for (var i = 0; i < bs.length; i++) {
      var o = bs[i].a === id ? bs[i].b : bs[i].a;
      if (o !== parent && seen[o]) out.push(o);
    }
    return out;
  }
  // The directions a walk may hand to the children of this centre: the VSEPR
  // arrangement rotated to agree with the neighbours that already have positions,
  // minus the slots those neighbours occupy.
  function freeSlotsOf(a, placed) {
    var cn = neighbours(a.id).length + implicitH(a), lp = lpCount(a);
    var sh = shapeDirs(cn, lp, a.sym);
    var phi = fitRotation(sh.bonds.concat(sh.lps), placed);
    var out = [], i, j;
    for (i = 0; i < sh.bonds.length; i++) {
      var ang = normAng(sh.bonds[i] + phi), used = false;
      for (j = 0; j < placed.length; j++) {
        if (angDist(ang, placed[j]) < 42 * D2R) used = true;
      }
      if (!used) out.push(ang);
    }
    // A ring closes over slots that are already spoken for; the relaxation sorts
    // the overlap out, and a walk with no direction at all would drop atoms on top.
    if (!out.length) {
      for (i = 0; i < sh.bonds.length; i++) out.push(normAng(sh.bonds[i] + phi));
    }
    return out;
  }
  function seedComponent(ids) {
    var root = ids[0];
    var seen = {}, parent = {}, order = [root];
    seen[root] = 1;
    for (var i = 0; i < order.length; i++) {
      var id = order[i], bs = bondsOf(id);
      for (var j = 0; j < bs.length; j++) {
        var o = bs[j].a === id ? bs[j].b : bs[j].a;
        if (seen[o]) continue;
        seen[o] = 1;
        parent[o] = id;
        order.push(o);
      }
    }
    var pos = {};
    pos[root] = { x: 0, y: 0 };
    for (var k = 0; k < order.length; k++) {
      var cid = order[k];
      if (!pos[cid]) continue;
      var kids = kidsOf(cid, cid === root ? null : parent[cid], seen);
      kids = kids.filter(function (x) { return !pos[x]; });
      if (!kids.length) continue;
      var back = cid === root ? 0 : Math.atan2(pos[cid].y - pos[parent[cid]].y, pos[cid].x - pos[parent[cid]].x);
      var me = atomById(cid);
      var useVsepr = ui.vsepr && me;
      var free = null;
      if (useVsepr) {
        var placed = [], bs2 = bondsOf(cid);
        for (j = 0; j < bs2.length; j++) {
          var nb2 = bs2[j].a === cid ? bs2[j].b : bs2[j].a;
          if (!pos[nb2]) continue;
          placed.push(Math.atan2(pos[cid].y - pos[nb2].y, pos[cid].x - pos[nb2].x));
        }
        free = freeSlotsOf(me, placed);
      }
      var span = kids.length === 1 ? 0 : Math.min(Math.PI * 5 / 6, Math.PI * 2 / 3 * (kids.length - 1));
      for (var m = 0; m < kids.length; m++) {
        var kid = kids[m], ka = atomById(kid);
        var a2 = free && free.length
          ? free[Math.min(m, free.length - 1)]
          : back + (kids.length === 1 ? 0 : -span / 2 + (span * m) / (kids.length - 1));
        var bond = bondBetween(cid, kid);
        var len = useVsepr && ka ? lengthPx(me.sym, ka.sym, !!(bond && bond.ionic)) : BOND_LEN;
        pos[kid] = { x: pos[cid].x + Math.cos(a2) * len, y: pos[cid].y + Math.sin(a2) * len };
      }
    }
    for (var n = 0; n < order.length; n++) {
      var at = atomById(order[n]);
      if (at && pos[order[n]]) { at.x = pos[order[n]].x; at.y = pos[order[n]].y; }
    }
  }
  function neighbours(id) {
    var out = [], bs = bondsOf(id);
    for (var i = 0; i < bs.length; i++) out.push({ id: bs[i].a === id ? bs[i].b : bs[i].a, order: bs[i].order || 1 });
    return out;
  }
  function bfsEdges(from, to, blocked) {
    var seen = {}, q = [[from, 0]];
    seen[from] = 1;
    for (var i = 0; i < q.length; i++) {
      var id = q[i][0], d = q[i][1];
      if (id === to) return d;
      var nb = neighbours(id);
      for (var j = 0; j < nb.length; j++) {
        var o = nb[j].id;
        if (seen[o] || o === blocked) continue;
        seen[o] = 1;
        q.push([o, d + 1]);
      }
    }
    return -1;
  }
  function shortestCycle(id) {
    var nb = neighbours(id), best = 0;
    for (var i = 0; i < nb.length; i++) {
      var d = bfsEdges(nb[i].id, id, id);
      if (d > 0) {
        var size = d + 1;
        if (!best || size < best) best = size;
      }
    }
    return best >= 3 && best <= 9 ? best : 0;
  }
  function relaxComponent(ids, steps) {
    if (ids.length < 2) return;
    var pos = {}, nb = {}, cycle = {}, i, j;
    for (i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      pos[a.id] = { x: a.x, y: a.y };
      nb[a.id] = neighbours(a.id);
      cycle[a.id] = shortestCycle(a.id);
    }
    var close2 = {};   // pairs within two bonds: the angle term owns those
    for (i = 0; i < ids.length; i++) {
      var u = ids[i];
      close2[u] = {};
      for (j = 0; j < nb[u].length; j++) {
        var v = nb[u][j].id;
        close2[u][v] = 1;
        var w2 = nb[v] || [];
        for (var k = 0; k < w2.length; k++) close2[u][w2[k].id] = 1;
      }
    }
    var L = BOND_LEN;
    // Each bond is pulled toward the length the scene would draw it at, so a Na-Cl
    // stays visibly longer than a C-C instead of being averaged into one length.
    var rest = {};
    for (i = 0; i < doc.bonds.length; i++) {
      var bx = doc.bonds[i], bA = atomById(bx.a), bB = atomById(bx.b);
      rest[bx.id] = ui.vsepr && bA && bB ? lengthPx(bA.sym, bB.sym, !!bx.ionic) : L;
    }
    for (var it = 0; it < (steps || 600); it++) {
      var damp = 0.5 * Math.pow(0.995, it);
      for (i = 0; i < doc.bonds.length; i++) {
        var b = doc.bonds[i];
        if (!pos[b.a] || !pos[b.b]) continue;
        var dx = pos[b.b].x - pos[b.a].x, dy = pos[b.b].y - pos[b.a].y;
        var d = Math.hypot(dx, dy) || 0.001;
        var f = (d - (rest[b.id] || L)) / d * 0.5 * damp;
        pos[b.a].x += dx * f; pos[b.a].y += dy * f;
        pos[b.b].x -= dx * f; pos[b.b].y -= dy * f;
      }
      for (i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (!pos[id] || nb[id].length < 2) continue;
        var list = nb[id].filter(function (x) { return pos[x.id]; });
        if (list.length < 2) continue;
        list.sort(function (p, q) {
          return Math.atan2(pos[p.id].y - pos[id].y, pos[p.id].x - pos[id].x) -
            Math.atan2(pos[q.id].y - pos[id].y, pos[q.id].x - pos[id].x);
        });
        for (j = 0; j < list.length; j++) {
          var p1 = list[j], p2 = list[(j + 1) % list.length];
          if (list.length === 2 && j === 1) break;
          var a1 = Math.atan2(pos[p1.id].y - pos[id].y, pos[p1.id].x - pos[id].x);
          var a2 = Math.atan2(pos[p2.id].y - pos[id].y, pos[p2.id].x - pos[id].x);
          var cur = a2 - a1;
          while (cur > Math.PI) cur -= 2 * Math.PI;
          while (cur < -Math.PI) cur += 2 * Math.PI;
          var curA = Math.abs(cur);
          var ideal = idealAngle(id, p1, p2, list.length, cycle, nb);
          var err = (ideal - curA) * 0.5 * damp;
          if (!isFinite(err) || Math.abs(err) < 1e-4) continue;
          var s = cur >= 0 ? 1 : -1;
          rotateAbout(pos, p1.id, id, -err * s);
          rotateAbout(pos, p2.id, id, err * s);
        }
      }
      for (i = 0; i < ids.length; i++) {
        for (j = i + 1; j < ids.length; j++) {
          var x1 = ids[i], x2 = ids[j];
          if (!pos[x1] || !pos[x2]) continue;
          if (close2[x1] && close2[x1][x2]) continue;
          var ddx = pos[x2].x - pos[x1].x, ddy = pos[x2].y - pos[x1].y;
          var dd = Math.hypot(ddx, ddy);
          var min = L * 0.78;
          if (dd > min || dd < 0.001) continue;
          var push = (min - dd) / dd * 0.5 * damp;
          pos[x1].x -= ddx * push; pos[x1].y -= ddy * push;
          pos[x2].x += ddx * push; pos[x2].y += ddy * push;
        }
      }
    }
    for (i = 0; i < ids.length; i++) {
      var at2 = atomById(ids[i]);
      if (at2 && pos[ids[i]]) { at2.x = pos[ids[i]].x; at2.y = pos[ids[i]].y; }
    }
  }
  // A piece that has just gained or lost a bond is allowed to settle into the
  // angles its own electron domains ask for. It is a settle, not a redraw: the
  // topology the user built is untouched and only the geometry inside it evens
  // out, around the one atom the edit was made from. That anchor is what keeps
  // growth predictable: adding the fifth chlorine to phosphorus moves the
  // chlorines, never the phosphorus the user is building from.
  function settleAround(id, anchorId) {
    if (!ui.vsepr || !id) return;
    var ids = componentOf(id);
    if (ids.length < 3) return;
    var anchor = atomById(anchorId || id);
    if (!anchor) return;
    var ax = anchor.x, ay = anchor.y;
    relaxComponent(ids, 140);
    var now = atomById(anchor.id);
    if (!now) return;
    var dx = ax - now.x, dy = ay - now.y;
    if (!dx && !dy) return;
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (a) { a.x += dx; a.y += dy; }
    }
  }
  // The angle the model asks for between two specific neighbours: the gap
  // between the two canonical slots they sit in. Pulling every pair to one bare
  // domain gap would ask ammonia for three 107-degree angles, which do not fit
  // around a point, and the relaxation would settle on 120 — erasing the very
  // space the lone pair is supposed to keep. Slots are taken from the drawn
  // positions, so a piece built joint by joint keeps the orientation it grew in.
  // Which bonding slot each drawn neighbour belongs to. The answer has to be a
  // pairing, not one independent nearest-slot lookup per neighbour: an atom
  // dropped onto a lone-pair direction is still only one of the model's bonding
  // positions, and two greedy lookups can land both of them on the same slot.
  // Taking the closest slot every time would then report no angle at all and let
  // the generic rule redraw linear XeF2 as bent.
  // The pairing also keeps the order the neighbours actually sit in around the
  // centre. That is what makes the angles the relaxation asks for fit around a
  // point: six bonds handed six slots in sequence means the gaps sum to a full
  // turn, so an octahedron being grown from a square can be evened out at all.
  // A nearest-slot greedy can instead hand out the slots out of sequence, which
  // asks for gaps that add up to more than 360 degrees, and the relaxation stalls
  // somewhere in the middle of that contradiction with two bonds nearly on top of
  // each other. Cheapest cyclic order is searched exhaustively: at most eight
  // slots, so the whole search is a few hundred comparisons.
  var slotMemo = {};
  function slotMap(id) {
    var at = atomById(id);
    if (!at) return null;
    var dr = drawnDirs(id);
    if (dr.length < 2) return null;
    var mkey = id + '|' + ui.rev + '|' + dr.map(function (d) {
      var o = atomById(d.id); return o ? Math.round(o.x * 8) + ',' + Math.round(o.y * 8) : 'x';
    }).join(';');
    if (Object.keys(slotMemo).length > 512) slotMemo = {};
    if (slotMemo[mkey] !== undefined) return slotMemo[mkey] || null;
    var res = null;
    var sh = shapeDirs(dr.length + implicitH(at), lpCount(at), at.sym);
    if (sh.bonds.length >= dr.length) {
      var phi = fitRotation(sh.bonds.concat(sh.lps), dr.map(function (d) { return d.ang; }));
      var can = [], i, j;
      for (i = 0; i < sh.bonds.length; i++) can.push(normAng(sh.bonds[i] + phi));
      can.sort(function (p, q) { return p - q; });
      var seq = [];
      for (i = 0; i < dr.length; i++) seq.push(i);
      seq.sort(function (p, q) { return normAng(dr[p].ang) - normAng(dr[q].ang); });
      var dAng = seq.map(function (k) { return normAng(dr[k].ang); });
      var D = dAng.length, S = can.length, best = null;
      for (var mask = 0; mask < (1 << S); mask++) {
        var sel = [], bits = 0;
        for (i = 0; i < S; i++) if (mask & (1 << i)) { sel.push(can[i]); bits++; }
        if (bits !== D) continue;
        for (var off = 0; off < D; off++) {
          var cost = 0;
          for (i = 0; i < D; i++) {
            var g = angDist(sel[(i + off) % D], dAng[i]);
            cost += g * g;
          }
          if (!best || cost < best.cost - 1e-12) best = { sel: sel, off: off, cost: cost };
        }
      }
      if (best) {
        res = { dr: dr, slots: {} };
        for (i = 0; i < D; i++) res.slots[seq[i]] = best.sel[(i + best.off) % D];
      }
    }
    slotMemo[mkey] = res || false;
    return res;
  }
  function slotAngle(id, other1, other2) {
    var m = slotMap(id);
    if (!m) return 0;
    var a = null, b = null;
    for (var i = 0; i < m.dr.length; i++) {
      if (m.dr[i].id === other1) a = m.slots[i];
      if (m.dr[i].id === other2) b = m.slots[i];
    }
    if (a === null || b === null) return 0;
    var d = Math.abs(a - b);
    return d > Math.PI ? 2 * Math.PI - d : d;
  }
  function idealAngle(id, p1, p2, deg, cycle, nb) {
    var rs = cycle[id];
    if (rs >= 3) {
      var r1 = (nb[p1.id] || []).some(function (x) { return x.id === id && cycle[p1.id] === rs; });
      var r2 = (nb[p2.id] || []).some(function (x) { return x.id === id && cycle[p2.id] === rs; });
      // Two ring bonds of the same ring keep that ring's interior angle; the
      // polygon closes only because they hold it.
      if (r1 && r2 && deg <= 3) return (rs - 2) * Math.PI / rs;
    }
    var at = atomById(id);
    if (at && ui.vsepr) {
      var g = slotAngle(id, p1.id, p2.id);
      if (g > 0) return g;
    }
    if (deg === 2) {
      var triple = p1.order >= 3 || p2.order >= 3;
      return triple ? Math.PI : Math.PI * 2 / 3;
    }
    if (deg === 3) return Math.PI * 2 / 3;
    if (deg === 4) return Math.PI / 2;
    return 2 * Math.PI / deg;
  }
  function rotateAbout(pos, id, pivot, ang) {
    var p = pos[id], c = pos[pivot];
    var dx = p.x - c.x, dy = p.y - c.y;
    var co = Math.cos(ang), si = Math.sin(ang);
    p.x = c.x + dx * co - dy * si;
    p.y = c.y + dx * si + dy * co;
  }
  function stackFragments(comps) {
    if (comps.length < 2) { centerComponent(comps[0]); return; }
    var cur = 0;
    for (var i = 0; i < comps.length; i++) {
      var bb = compBBox(comps[i]);
      var w = bb.maxX - bb.minX;
      var shift = cur - bb.minX;
      var at;
      for (var j = 0; j < comps[i].length; j++) {
        at = atomById(comps[i][j]);
        if (!at) continue;
        at.x += shift;
        at.y += GRID * 1.5;
      }
      cur += w + BOND_LEN * 2.5;
    }
    var all = [];
    for (var k = 0; k < comps.length; k++) all = all.concat(comps[k]);
    centerComponent(all);
  }
  function compBBox(ids) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
      minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
    }
    if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }
  function centerComponent(ids) {
    if (!ids || !ids.length) return;
    var bb = compBBox(ids);
    var cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      a.x -= cx;
      a.y -= cy;
    }
  }

  // ---- view -------------------------------------------------------------
  function zoomAt(factor, sx, sy) {
    var z0 = ui.zoom;
    var z1 = Math.min(4, Math.max(0.2, z0 * factor));
    if (z1 === z0) return;
    var w0 = (sx - ui.pan.x) / z0;
    var w1 = (sy - ui.pan.y) / z0;
    ui.zoom = z1;
    ui.pan.x = sx - w0 * z1;
    ui.pan.y = sy - w1 * z1;
    scheduleSave();
    refresh();
  }
  function zoomStep(f) {
    var r = els.canvasWrap.getBoundingClientRect();
    zoomAt(f, r.width / 2, r.height / 2);
  }
  function actFit() {
    var r = els.canvasWrap.getBoundingClientRect();
    if (!doc.atoms.length) {
      ui.zoom = 1;
      ui.pan = { x: r.width / 2, y: r.height / 2 };
      scheduleSave();
      refresh();
      return;
    }
    buildView();
    var bb = viewBBox();
    var pad = 46;
    var w = Math.max(1, bb.w), h = Math.max(1, bb.h);
    var z = Math.min((r.width - pad * 2) / w, (r.height - pad * 2) / h);
    ui.zoom = Math.min(4, Math.max(0.2, z));
    ui.pan.x = r.width / 2 - (bb.x + w / 2) * ui.zoom;
    ui.pan.y = r.height / 2 - (bb.y + h / 2) * ui.zoom;
    scheduleSave();
    refresh();
  }

  // ==========================================================================
  // 7. Render view-model + painting.
  // ==========================================================================
  var FONT_SYM = '700 17px ui-monospace,"Cascadia Mono",Consolas,monospace';
  var FONT_SUB = '700 12px ui-monospace,"Cascadia Mono",Consolas,monospace';
  var FONT_SUP = '700 11px ui-monospace,"Cascadia Mono",Consolas,monospace';
  var H_SYM = 19;

  function foldedH() {
    // {hidden:{atomId:1}, groups:{parentId:[{n,ux,uy}]}} when hydrogens are folded
    var hidden = {}, groups = {};
    if (ui.showH) return { hidden: hidden, groups: groups };
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      if (a.sym !== 'H') continue;
      var bs = bondsOf(a.id);
      if (bs.length !== 1 || (bs[0].order || 1) !== 1) continue;
      var p = bs[0].a === a.id ? bs[0].b : bs[0].a;
      var pa = atomById(p);
      if (!pa || pa.sym === 'H') continue;
      hidden[a.id] = 1;
      var dx = a.x - pa.x, dy = a.y - pa.y;
      var L = Math.hypot(dx, dy) || 1;
      if (!groups[p]) groups[p] = [];
      groups[p].push({ ux: dx / L, uy: dy / L });
    }
    return { hidden: hidden, groups: groups };
  }
  function withFoldedH(ids) {
    // A folded hydrogen travels with the atom its label was merged into.
    var out = ids.slice();
    var fold = foldedH();
    var seen = {};
    for (var i = 0; i < out.length; i++) seen[out[i]] = 1;
    for (var k = 0; k < doc.atoms.length; k++) {
      var a = doc.atoms[k];
      if (!fold.hidden[a.id] || seen[a.id]) continue;
      var bs = bondsOf(a.id);
      if (bs.length && seen[bs[0].a === a.id ? bs[0].b : bs[0].a]) { out.push(a.id); seen[a.id] = 1; }
    }
    return out;
  }

  function measure(ctx, segs) {
    var w = 0;
    for (var i = 0; i < segs.length; i++) {
      ctx.font = FONT_SYM;
      w += ctx.measureText(segs[i].t).width;
      if (segs[i].n > 1) { ctx.font = FONT_SUB; w += ctx.measureText(String(segs[i].n)).width; }
    }
    return w;
  }

  function buildView() {
    var c = els.canvas;
    var ctx = c.getContext('2d');
    var fold = foldedH();
    var av = [], byId = {}, i, j;
    for (i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      if (fold.hidden[a.id]) continue;
      var el = elOf(a.sym) || { sym: a.sym, ink: pal().ink };
      var ink = legible(el.ink || el.color);
      var dirs = [];
      var nbs = neighbours(a.id);
      for (j = 0; j < nbs.length; j++) {
        if (fold.hidden[nbs[j].id]) continue;
        var o = atomById(nbs[j].id);
        if (!o) continue;
        var dx = o.x - a.x, dy = o.y - a.y;
        var L = Math.hypot(dx, dy) || 1;
        dirs.push({ ux: dx / L, uy: dy / L });
      }
      var pre = [], post = [], above = [], below = [];
      var gl = fold.groups[a.id] || [];
      for (j = 0; j < gl.length; j++) {
        var n = 0, ux = 0, uy = 0, k2;
        for (k2 = 0; k2 < gl.length; k2++) { if (gl[k2] !== gl[j]) continue; n++; ux += gl[k2].ux; uy += gl[k2].uy; }
        var LL = Math.hypot(ux, uy) || 1;
        ux /= LL; uy /= LL;
        var seg = { t: 'H', n: n, ux: ux, uy: uy, seen: false };
        if (gl[j].seen) continue;
        for (k2 = 0; k2 < gl.length; k2++) gl[k2].seen = true;
        if (Math.abs(ux) >= Math.abs(uy)) { if (ux > 0) post.push(seg); else pre.push(seg); }
        else { if (uy > 0) below.push(seg); else above.push(seg); }
      }
      pre.reverse();
      ctx.font = FONT_SYM;
      var wSym = ctx.measureText(a.sym).width;
      var wPre = measure(ctx, pre), wPost = measure(ctx, post);
      var wAb = measure(ctx, above), wBe = measure(ctx, below);
      var over = false;
      var v = capacityOf(a.sym);
      if (v && covSum(a.id) > v) over = true;
      var box = {
        id: a.id, sym: a.sym, x: a.x, y: a.y, ink: ink, q: a.q || 0, lp: lpCount(a),
        lpAng: ui.vsepr ? lpDirsOf(a) : [],
        pre: pre, post: post, above: above, below: below,
        wSym: wSym, wPre: wPre, wPost: wPost,
        w: Math.max(wPre + wSym + wPost, wAb, wBe, 15) + 6,
        h: H_SYM + (above.length ? 7 : 0) + (below.length ? 7 : 0),
        dirs: dirs, over: over
      };
      av.push(box);
      byId[a.id] = box;
    }
    var bv = [];
    for (i = 0; i < doc.bonds.length; i++) {
      var b = doc.bonds[i];
      var A = byId[b.a], B = byId[b.b];
      if (!A || !B) continue;
      bv.push({ id: b.id, order: Math.max(1, b.order || 1), ionic: !!b.ionic, A: A, B: B, a: b.a, b: b.b, hot: false });
    }
    var bk = [];
    for (i = 0; i < doc.brackets.length; i++) {
      var g = doc.brackets[i];
      var ids = (g.ids || []).filter(function (id) { return byId[id]; });
      if (ids.length < 1) continue;
      var bb = boxOf(ids, byId);
      bk.push({ key: g.key, ids: ids, bb: bb, q: netCharge(g.ids || []) });
    }
    var shells = {};
    if (ui.shells) for (i = 0; i < av.length; i++) shells[av[i].id] = shellCounts(av[i].sym);
    view = { atoms: av, byId: byId, bonds: bv, brackets: bk, shells: shells };
    if (ui.previewBond) {
      var pa2 = byId[ui.previewBond.id];
      if (pa2) view.preview = { from: pa2, x: ui.previewBond.x, y: ui.previewBond.y };
    }
    var jp = jointPreview();
    view.joints = jp ? jp.list : [];
    view.jointPick = jp ? jp.pick : -1;
    return view;
  }
  // What the board would accept right now, under the pointer: the free joints, and
  // the one the next click takes. Drawn before the commit so the player is never
  // guessing which position the atom will end up in.
  function jointPreview() {
    if (!ui.vsepr || !ui.lastPointer) return null;
    // A carried fragment shows the one joint it is about to dock onto.
    if (ui.drag && ui.drag.mode === 'move') {
      return ui.drag.dock ? { list: [ui.drag.dock.joint], pick: 0 } : null;
    }
    if (ui.tool !== 'atom' && ui.tool !== 'bond') return null;
    if (hitAtom(ui.lastPointer.x, ui.lastPointer.y)) return null;
    var p = ui.lastPointer, list, pick, i;
    var from = (ui.previewBond && ui.previewBond.id) || 0;
    if (from && atomById(from)) {
      var f = atomById(from);
      list = jointsOf(from, ui.el, ui.bond);
      pick = -1;
      var ang = Math.atan2(p.y - f.y, p.x - f.x), bs = Infinity;
      for (i = 0; i < list.length; i++) {
        var s = angDist(list[i].ang, ang) + (list[i].kind === 'lp' ? 0.6 : 0);
        if (s < bs) { bs = s; pick = i; }
      }
    } else {
      list = jointsNear(p.x, p.y, ui.el, ui.bond).slice(0, 14);
      pick = list.length ? 0 : -1;
    }
    return list.length ? { list: list, pick: pick } : null;
  }
  function boxOf(ids, byId) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < ids.length; i++) {
      var v = (byId || view.byId)[ids[i]];
      if (!v) continue;
      minX = Math.min(minX, v.x - v.w / 2); maxX = Math.max(maxX, v.x + v.w / 2);
      minY = Math.min(minY, v.y - v.h / 2); maxY = Math.max(maxY, v.y + v.h / 2);
    }
    if (minX === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  function viewBBox() {
    if (!view || !view.atoms.length) return { x: 0, y: 0, w: 0, h: 0 };
    var bb = boxOf(view.atoms.map(function (v) { return v.id; }), view.byId);
    var pad = GRID;
    return { x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
  }
  function shellCounts(sym) {
    var el = elOf(sym);
    var z = el ? el.z : 0;
    if (!z) return [];
    var P = window.Mol3DPhysics;
    if (P && P.electronConfiguration) {
      try {
        var cfg = P.electronConfiguration(z);
        if (cfg && cfg.shells) {
          var out = [], s;
          for (s = 1; s <= 7; s++) if (cfg.shells[s]) out.push(cfg.shells[s]);
          if (out.length) return out;
        }
      } catch (e) { /* the fallback table below covers every element anyway */ }
    }
    var rem = z, out2 = [], caps = [2, 8, 18, 32, 32, 18, 8];
    for (var i = 0; i < caps.length && rem > 0; i++) {
      var n = Math.min(caps[i], rem);
      out2.push(n);
      rem -= n;
    }
    return out2;
  }

  function render() {
    if (!els.canvas || !ui.open || ui.min) return;
    var wrap = els.canvasWrap;
    var W = wrap.clientWidth, H = wrap.clientHeight;
    if (W < 20 || H < 20) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (els.canvas.width !== Math.round(W * dpr) || els.canvas.height !== Math.round(H * dpr)) {
      els.canvas.width = Math.round(W * dpr);
      els.canvas.height = Math.round(H * dpr);
    }
    buildView();
    paint(els.canvas.getContext('2d'), W, H, dpr, { x: ui.pan.x, y: ui.pan.y, z: ui.zoom }, false);
  }

  function paint(ctx, W, H, scale, vp, forExport) {
    curVp = vp;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = pal().board;
    ctx.fillRect(0, 0, W, H);
    if (!view) buildView();
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.z, vp.z);
    drawGrid(ctx, W, H, vp, forExport);
    drawBrackets(ctx);
    drawBonds(ctx);
    if (ui.shells) drawShells(ctx);
    drawAtoms(ctx, forExport);
    if (!forExport) { drawSelection(ctx); drawPreview(ctx); }
    ctx.restore();
  }

  function drawGrid(ctx, W, H, vp, forExport) {
    if (forExport || !ui.grid) return;
    var step = GRID, x, y;
    var left = -vp.x / vp.z, top = -vp.y / vp.z;
    var right = left + W / vp.z, bottom = top + H / vp.z;
    ctx.lineWidth = 1 / vp.z;
    ctx.strokeStyle = pal().grid;
    var minor = step / 2;
    if (vp.z > 0.75) {
      ctx.beginPath();
      for (x = Math.ceil(left / minor) * minor; x < right; x += minor) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
      for (y = Math.ceil(top / minor) * minor; y < bottom; y += minor) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
      ctx.stroke();
    }
    ctx.strokeStyle = pal().gridMajor;
    ctx.beginPath();
    for (x = Math.ceil(left / step) * step; x < right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
    for (y = Math.ceil(top / step) * step; y < bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
    ctx.stroke();
    ctx.strokeStyle = pal().axis;
    ctx.lineWidth = 1.4 / vp.z;
    ctx.beginPath();
    ctx.moveTo(0, top); ctx.lineTo(0, bottom);
    ctx.moveTo(left, 0); ctx.lineTo(right, 0);
    ctx.stroke();
  }

  function trimEnd(v, ux, uy, grow) {
    var hw = v.w / 2 + 3 + (grow || 0), hh = v.h / 2 + 3 + (grow || 0);
    var au = Math.abs(ux) || 1e-6, av2 = Math.abs(uy) || 1e-6;
    return Math.min(hw / au, hh / av2);
  }

  // Which end of an ionic bond gave the electron away. The game's own metal table
  // decides, so the drawing never contradicts the scene.
  function cationEnd(bondView) {
    var A = atomById(bondView.a), B = atomById(bondView.b);
    if (!A || !B) return bondView.A;
    var r = rules();
    if (r && typeof r.isMetal === 'function') {
      try {
        if (r.isMetal(gameEl(A.sym))) return bondView.A;
        if (r.isMetal(gameEl(B.sym))) return bondView.B;
      } catch (e) { /* fall through */ }
    }
    var ea = (gameEl(A.sym) || {}).en || 0, eb = (gameEl(B.sym) || {}).en || 0;
    return ea <= eb ? bondView.A : bondView.B;
  }
  function drawBonds(ctx) {
    for (var i = 0; i < view.bonds.length; i++) {
      var b = view.bonds[i];
      var dx = b.B.x - b.A.x, dy = b.B.y - b.A.y;
      var L = Math.hypot(dx, dy);
      if (L < 0.5) continue;
      var ux = dx / L, uy = dy / L;
      var t1 = trimEnd(b.A, ux, uy), t2 = trimEnd(b.B, -ux, -uy);
      if (t1 + t2 >= L - 1) continue;
      var x1 = b.A.x + ux * t1, y1 = b.A.y + uy * t1;
      var x2 = b.B.x - ux * t2, y2 = b.B.y - uy * t2;
      var hot = ui.hover && ui.hover.type === 'bond' && ui.hover.id === b.id;
      ctx.lineCap = 'round';
      ctx.strokeStyle = hot ? pal().hot : pal().line;
      ctx.lineWidth = hot ? 3 : 2.5;
      if (b.ionic) {
        // A transferred electron is not a shared pair: the convention is a dotted
        // line, with + on the donor and − on the acceptor.
        ctx.save();
        ctx.setLineDash([2.6 / curVp.z, 3.4 / curVp.z]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        var cat = cationEnd(b) === b.A ? 1 : 2;
        var fx = cat === 1 ? x1 : x2, fy = cat === 1 ? y1 : y2;
        var sx = cat === 1 ? x2 : x1, sy = cat === 1 ? y2 : y1;
        ctx.font = FONT_SUP;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = hot ? pal().hot : pal().pos;
        ctx.fillText('+', fx + ux * 9, fy + uy * 9 - 6 / curVp.z);
        ctx.fillStyle = hot ? pal().hot : pal().neg;
        ctx.fillText('−', sx - ux * 9, sy - uy * 9 - 6 / curVp.z);
        ctx.restore();
        continue;
      }
      var px = -uy, py = ux;
      var n = b.order;
      if (n === 1) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      } else {
        var gap = 3.4 + (n - 2) * 0.8;
        var shortF = n >= 3 ? 0.16 : 0.05;
        for (var k = 0; k < n; k++) {
          var off = (k - (n - 1) / 2) * gap;
          var sh = (k === 0 || k === n - 1) && n >= 3 ? shortF : 0.02;
          ctx.beginPath();
          ctx.moveTo(x1 + px * off + ux * L * sh, y1 + py * off + uy * L * sh);
          ctx.lineTo(x2 + px * off - ux * L * sh, y2 + py * off - uy * L * sh);
          ctx.stroke();
        }
      }
    }
  }

  function drawAtoms(ctx, forExport) {
    var i, j, v;
    for (i = 0; i < view.atoms.length; i++) {
      v = view.atoms[i];
      var selected = selHas(v.id);
      if (!forExport && selected) {
        ctx.save();
        ctx.shadowColor = pal().a(0.85);
        ctx.shadowBlur = 14;
        ctx.fillStyle = pal().a(0.14);
        roundBox(ctx, v.x - v.w / 2, v.y - v.h / 2, v.w, v.h, 5);
        ctx.fill();
        ctx.restore();
      }
      if (v.over) {
        ctx.strokeStyle = pal().over;
        ctx.setLineDash([3 / curVp.z, 3 / curVp.z]);
        ctx.lineWidth = 1.2;
        roundBox(ctx, v.x - v.w / 2 - 2, v.y - v.h / 2 - 2, v.w + 4, v.h + 4, 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // bond stubs behind the letters
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      var total = v.wPre + v.wSym + v.wPost;
      var pen = v.x - total / 2;
      for (j = 0; j < v.pre.length; j++) pen = drawSeg(ctx, v.pre[j], pen, v.y, v.ink);
      ctx.font = FONT_SYM;
      ctx.fillStyle = v.ink;
      ctx.fillText(v.sym, pen, v.y);
      pen += v.wSym;
      for (j = 0; j < v.post.length; j++) pen = drawSeg(ctx, v.post[j], pen, v.y, v.ink);
      if (v.above.length) drawStacked(ctx, v.above, v.x, v.y - v.h / 2 - 1, v.ink, -1);
      if (v.below.length) drawStacked(ctx, v.below, v.x, v.y + v.h / 2 + 1, v.ink, 1);
      if (ui.showQ && v.q) {
        ctx.font = FONT_SUP;
        ctx.fillStyle = v.q > 0 ? pal().pos : pal().neg;
        ctx.textAlign = 'left';
        var cx = v.x + total / 2 + 1.5, cy = v.y - v.h / 2 + 4;
        ctx.fillText(supCharge(v.q), cx, cy);
      }
      if (ui.showLP && v.lp) drawLonePairs(ctx, v);
    }
  }
  function drawSeg(ctx, seg, x, y, ink) {
    ctx.font = FONT_SYM;
    ctx.fillStyle = ink;
    ctx.fillText(seg.t, x, y);
    var w = ctx.measureText(seg.t).width;
    if (seg.n > 1) {
      ctx.font = FONT_SUB;
      ctx.fillText(String(seg.n), x + w, y + 3.5);
      w += ctx.measureText(String(seg.n)).width;
    }
    return x + w;
  }
  function drawStacked(ctx, segs, x, y, ink, dir) {
    var w = measure(ctx, segs), pen = x - w / 2, i;
    for (i = 0; i < segs.length; i++) pen = drawSeg(ctx, segs[i], pen, y + dir * 5, ink);
  }
  function supCharge(q) {
    var a = Math.abs(q);
    return (a > 1 ? String(a) : '') + (q > 0 ? '+' : '−');
  }
  var LP_COMPASS = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
  function drawLonePairs(ctx, v) {
    var cand, used = [], i, j;
    if (v.lpAng && v.lpAng.length) {
      // The model's own directions first; a hand-set count above them still gets
      // its dots, just in the nearest clear compass slot.
      cand = v.lpAng.slice();
      for (i = 0; i < LP_COMPASS.length && cand.length < v.lp; i++) {
        if (cand.indexOf(LP_COMPASS[i]) < 0) cand.push(LP_COMPASS[i]);
      }
    } else {
      cand = LP_COMPASS.slice();
    }
    for (i = 0; i < cand.length; i++) {
      var a = cand[i];
      var minD = 99;
      for (j = 0; j < v.dirs.length; j++) {
        var d = Math.abs(angDiff(a, Math.atan2(v.dirs[j].uy, v.dirs[j].ux)));
        minD = Math.min(minD, d);
      }
      for (j = 0; j < used.length; j++) minD = Math.min(minD, Math.abs(angDiff(a, used[j])) * 0.6);
      used.push(a);
      cand[i] = { a: a, score: minD };
    }
    cand.sort(function (p, q) { return q.score - p.score; });
    var n = Math.min(v.lp, 6);
    ctx.fillStyle = v.ink;
    for (i = 0; i < n; i++) {
      var ang = cand[i].a;
      var r = trimEnd(v, Math.cos(ang), Math.sin(ang), 6);
      var cx = v.x + Math.cos(ang) * r, cy = v.y + Math.sin(ang) * r;
      var px = -Math.sin(ang) * 3.4, py = Math.cos(ang) * 3.4;
      ctx.beginPath();
      ctx.arc(cx + px, cy + py, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - px, cy - py, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function angDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  function roundBox(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function drawShells(ctx) {
    var i, j;
    for (i = 0; i < view.atoms.length; i++) {
      var v = view.atoms[i];
      var counts = view.shells[v.id];
      if (!counts) continue;
      var base = Math.max(v.w, v.h) / 2 + 5;
      for (j = 0; j < counts.length; j++) {
        var r = base + j * 11;
        ctx.strokeStyle = pal().a(0.3);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(v.x, v.y, r, 0, Math.PI * 2);
        ctx.stroke();
        var n = Math.min(counts[j], 18);
        ctx.fillStyle = pal().electron;
        for (var k = 0; k < n; k++) {
          var a = (k / n) * Math.PI * 2 - Math.PI / 2 + j * 0.22;
          ctx.beginPath();
          ctx.arc(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, 1.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  function drawBrackets(ctx) {
    for (var i = 0; i < view.brackets.length; i++) {
      var g = view.brackets[i];
      var pad = 9;
      var x = g.bb.x - pad, y = g.bb.y - pad, w = g.bb.w + pad * 2, h = g.bb.h + pad * 2;
      var arm = Math.max(7, Math.min(15, h * 0.22));
      ctx.strokeStyle = pal().warn;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x + arm, y); ctx.lineTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + arm, y + h);
      ctx.moveTo(x + w - arm, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - arm, y + h);
      ctx.stroke();
      if (g.q) {
        ctx.font = FONT_SUP;
        ctx.fillStyle = g.q > 0 ? pal().pos : pal().neg;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(supCharge(g.q), x + w + 3, y + 6);
      }
    }
  }
  function drawSelection(ctx) {
    if (ui.box) {
      var b = ui.box;
      ctx.strokeStyle = pal().a(0.9);
      ctx.fillStyle = pal().a(0.08);
      ctx.lineWidth = 1 / curVp.z;
      ctx.setLineDash([4 / curVp.z, 3 / curVp.z]);
      var x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
      var w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }
  // Every free joint under the pointer, drawn as a ring, with the one the next
  // click takes picked out and its bond already ghosted in. The player sees the
  // chemistry's answer before committing to it.
  function drawJoints(ctx) {
    var z = Math.max(0.35, curVp ? curVp.z : 1), i;
    var list = view.joints, pick = view.jointPick;
    for (i = 0; i < list.length; i++) {
      var j = list[i], on = i === pick, par = view.byId[j.parent];
      if (on && par) {
        var dx = j.x - par.x, dy = j.y - par.y, L = Math.hypot(dx, dy) || 1;
        ctx.strokeStyle = pal().a(0.55);
        ctx.lineWidth = 1.6 / z;
        ctx.setLineDash([5 / z, 4 / z]);
        ctx.beginPath();
        ctx.moveTo(par.x + dx / L * trimEnd(par, dx / L, dy / L), par.y + dy / L * trimEnd(par, dx / L, dy / L));
        ctx.lineTo(j.x, j.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(j.x, j.y, (on ? 7 : 4.2) / z, 0, Math.PI * 2);
      ctx.fillStyle = on ? pal().a(0.30) : (j.kind === 'lp' ? pal().lpJoint : pal().a(0.11));
      ctx.fill();
      ctx.strokeStyle = on ? pal().accent : pal().a(0.45);
      ctx.lineWidth = (on ? 1.9 : 1) / z;
      ctx.stroke();
    }
  }
  function drawPreview(ctx) {
    if (view.joints && view.joints.length) drawJoints(ctx);
    if (view.preview) {
      ctx.strokeStyle = pal().a(0.85);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6 / ui.zoom, 4 / ui.zoom]);
      var f = view.preview.from;
      var dx = view.preview.x - f.x, dy = view.preview.y - f.y;
      var L = Math.hypot(dx, dy) || 1;
      var t1 = trimEnd(f, dx / L, dy / L);
      ctx.beginPath();
      ctx.moveTo(f.x + dx / L * t1, f.y + dy / L * t1);
      ctx.lineTo(view.preview.x, view.preview.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (ui.hover && ui.hover.type === 'atom' && view.byId[ui.hover.id]) {
      var v = view.byId[ui.hover.id];
      ctx.strokeStyle = pal().a(0.55);
      ctx.lineWidth = 1.4;
      roundBox(ctx, v.x - v.w / 2 - 2, v.y - v.h / 2 - 2, v.w + 4, v.h + 4, 6);
      ctx.stroke();
    }
  }

  // ---- hit testing (world coordinates) -----------------------------------
  function hitAtom(wx, wy) {
    if (!view) buildView();
    var best = null, bestD = Infinity;
    for (var i = 0; i < view.atoms.length; i++) {
      var v = view.atoms[i];
      var hw = v.w / 2 + 4, hh = v.h / 2 + 4;
      var dx = Math.abs(wx - v.x), dy = Math.abs(wy - v.y);
      if (dx > hw + 6 || dy > hh + 6) continue;
      var inside = dx <= hw && dy <= hh;
      var d = Math.hypot(Math.max(0, dx - hw), Math.max(0, dy - hh));
      if (inside) d = -1 + d;
      if (d < bestD) { bestD = d; best = v; }
    }
    return best && bestD < 12 ? best : null;
  }
  function hitBond(wx, wy) {
    if (!view) buildView();
    var best = null, bestD = 11 / Math.max(0.4, ui.zoom);
    for (var i = 0; i < view.bonds.length; i++) {
      var b = view.bonds[i];
      var dx = b.B.x - b.A.x, dy = b.B.y - b.A.y;
      var L2 = dx * dx + dy * dy;
      if (L2 < 1) continue;
      var t = ((wx - b.A.x) * dx + (wy - b.A.y) * dy) / L2;
      if (t < 0.05 || t > 0.95) continue;
      var px = b.A.x + dx * t, py = b.A.y + dy * t;
      var d = Math.hypot(wx - px, wy - py);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // ==========================================================================
  // 8. Panel chrome: labels, readout, element picker.
  // ==========================================================================
  var curVp = { x: 0, y: 0, z: 1 };

  // Hill order within one fragment: carbon, then hydrogen, then everything else
  // alphabetically (and without carbon, hydrogen joins that alphabetical run).
  function hillOf(counts) {
    var other = Object.keys(counts).filter(function (k) { return k !== 'C' && k !== 'H'; }).sort();
    var out = [];
    if (counts.C) out.push({ t: 'C', n: counts.C });
    if (counts.H) out.push({ t: 'H', n: counts.H });
    for (var i = 0; i < other.length; i++) out.push({ t: other[i], n: counts[other[i]] });
    return out;
  }
  // One entry per distinct fragment on the board, each counted separately. Two lone
  // argon atoms are two atoms of argon and must never read as a bonded Og2; a board
  // of three waters reads as 3 H2O, with the coefficient saying they are apart.
  function formulaTerms() {
    var comps = components(), byKeys = {}, order = [];
    for (var c = 0; c < comps.length; c++) {
      var ids = comps[c], counts = {};
      for (var i = 0; i < ids.length; i++) {
        var a = atomById(ids[i]);
        if (a) counts[a.sym] = (counts[a.sym] || 0) + 1;
      }
      var terms = hillOf(counts), key = '';
      for (var j = 0; j < terms.length; j++) key += terms[j].t + terms[j].n;
      var q = netCharge(ids);
      var slot = key + '|' + q;
      var g = byKeys[slot];
      if (!g) { g = { terms: terms, q: q, n: 0 }; byKeys[slot] = g; order.push(g); }
      g.n++;
    }
    return order;
  }
  function formulaHtml() {
    var groups = formulaTerms();
    if (!groups.length) return '<b>' + tx('emptyFormula') + '</b>';
    var parts = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], s = g.n > 1 ? g.n + ' ' : '';
      for (var j = 0; j < g.terms.length; j++) {
        s += g.terms[j].t + (g.terms[j].n > 1 ? '<sub>' + g.terms[j].n + '</sub>' : '');
      }
      if (g.q) s += '<span class="bp-chg">' + supHTML(g.q) + '</span>';
      parts.push(s);
    }
    return '<b>' + parts.join(' · ') + '</b>';
  }
  function supHTML(q) {
    var a = Math.abs(q);
    return '<sup>' + (a > 1 ? a : '') + (q > 0 ? '+' : '−') + '</sup>';
  }
  function updateReadout() {
    var comps = components();
    var over = 0;
    for (var i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      var v = capacityOf(a.sym);
      if (v && covSum(a.id) > v) over++;
    }
    // Every tool now asks the game before a line reaches the board, so this should
    // read zero. It exists for documents that came in from a file or an older save.
    var illegal = auditBonds().length;
    var bits = [formulaHtml()];
    bits.push('<span>' + tx('countsLbl') + ': ' + doc.atoms.length + '/' + doc.bonds.length + '</span>');
    if (comps.length > 1) bits.push('<span class="bp-chip">' + comps.length + ' ' +
      tx(comps.length > 1 ? 'fragments' : 'fragment') + '</span>');
    var rings = ringCount();
    if (rings) bits.push('<span class="bp-chip">' + rings + ' ' + tx('ringNote') + '</span>');
    if (over) bits.push('<span class="bp-chip">' + over + ' ' + ic('triangle-alert') + '</span>');
    if (illegal) bits.push('<span class="bp-chip err">' + illegal + ' ' + tx('badBonds') + '</span>');
    els.readout.innerHTML = bits.join(' · ');
    lucideIn(els.readout);
  }
  function syncHint() {
    var str = null;
    for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i].id === ui.tool) str = TOOLS[i].str;
    var txt = str ? tx(str) : '';
    if (ui.sel.length) txt = tx('selN', { n: ui.sel.length }) + ' — ' + txt;
    if (ui.pendingBond) txt = tx('tBond');
    else if (ui.vsepr && (ui.tool === 'atom' || ui.tool === 'bond')) txt += ' · ' + tx('altFreeNote');
    els.hint.textContent = txt;
  }
  function syncCursor() {
    var c = 'default';
    if (ui.tool === 'atom' || ui.tool === 'bond') c = 'crosshair';
    else if (ui.tool === 'erase') c = 'not-allowed';
    else if (ui.tool === 'pan') c = 'grab';
    if (ui.drag && ui.drag.mode === 'pan') c = 'grabbing';
    if (ui.space) c = 'grab';
    els.canvas.style.cursor = c;
  }
  function syncButtons() {
    els.title.textContent = tx('title');
    els.min.title = ui.min ? tx('expand') : tx('minimize');
    els.min.setAttribute('aria-label', els.min.title);
    els.help.title = tx('help');
    els.close.title = tx('close');
    els.orderLbl.textContent = tx('sOrder');
    var i, b;
    var tools = els.rail.querySelectorAll('.bp-tool');
    for (i = 0; i < tools.length; i++) {
      b = tools[i];
      var id = b.dataset.tool;
      var def = null;
      for (var k = 0; k < TOOLS.length; k++) if (TOOLS[k].id === id) def = TOOLS[k];
      if (!def) continue;
      b.classList.toggle('on', ui.tool === id);
      b.textContent = id === 'atom' ? ui.el : tx(def.lbl);
      b.title = tx(def.str);
    }
    var orders = els.orders.querySelectorAll('button');
    for (i = 0; i < orders.length; i++) {
      b = orders[i];
      b.classList.toggle('on', +b.dataset.o === ui.bond);
      b.title = tx('bond' + b.dataset.o);
    }
    var tgs = els.panel.querySelectorAll('.bp-tg');
    var TG = { grid: 'sGrid', showH: 'sH', showQ: 'sQ', showLP: 'sLP', shells: 'sBohr', vsepr: 'sVsepr' };
    var TGK = { grid: 'grid', showH: 'hydrogens', showQ: 'charges', showLP: 'lp', shells: 'shells', vsepr: 'vsepr' };
    for (i = 0; i < tgs.length; i++) {
      b = tgs[i];
      var key = b.dataset.tg;
      b.classList.toggle('on', !!ui[key]);
      b.querySelector('span').textContent = tx(TG[key]);
      b.title = tx(TGK[key]);
    }
    var el = elOf(ui.el);
    els.elSym.textContent = ui.el;
    els.elSym.style.color = el ? legible(el.ink || el.color) : pal().ink;
    els.elName.textContent = el ? elNameLocal(el) : '';
    els.elchip.title = tx('element') + (el ? ': ' + elNameLocal(el) + ' (Z=' + el.z + ')' : '');
    els.elSearch.placeholder = tx('elSearchPh');
    var ACT = {
      undo: ['sUndo', 'undo'], redo: ['sRedo', 'redo'], copy: ['sCopy', 'copy'], cut: ['sCut', 'cut'],
      paste: ['sPaste', 'paste'], all: ['sAll', 'selectAll'], del: ['sDel', 'del'],
      addH: ['sAddH', 'addH'], clean: ['sClean', 'clean'], fit: ['sFit', 'fit'],
      to3d: ['s3D', 'to3d'], png: ['png', 'png'], mol: ['mol', 'mol'], smiles: ['smiles', 'smiles']
    };
    for (var act in ACT) {
      if (!Object.prototype.hasOwnProperty.call(ACT, act)) continue;
      b = $(act);
      if (!b) continue;
      b.textContent = tx(ACT[act][0]);
      b.title = tx(ACT[act][1]);
      if (act === 'undo') b.disabled = !ui.hist.length;
      if (act === 'redo') b.disabled = !ui.future.length;
      if (act === 'copy' || act === 'cut' || act === 'del') b.disabled = !ui.sel.length;
      if (act === 'paste') b.disabled = !ui.clip || !ui.clip.atoms.length;
      if (act === 'to3d') b.disabled = !doc.atoms.length;
    }
    var zb = els.zoomBtns.querySelectorAll('button');
    for (i = 0; i < zb.length; i++) {
      zb[i].title = zb[i].dataset.z === 'in' ? tx('zin') : zb[i].dataset.z === 'out' ? tx('zout') : tx('fit');
    }
    els.io.querySelector('[data-io="copy"]').textContent = tx('copyText');
    els.io.querySelector('[data-io="save"]').textContent = tx('saveAs');
    els.io.querySelector('[data-io="close"]').textContent = tx('closeBtn');
    els.helpCard.querySelector('[data-help="close"]').textContent = tx('closeBtn');
    els.helpTitle.textContent = tx('helpTitle');
    els.ioText.disabled = !els.io.classList.contains('open');
    if (ui.help) renderHelp();
    syncHint();
    syncCursor();
  }
  function refresh() {
    render();
    updateReadout();
    syncButtons();
  }

  function openElPop(force) {
    elPopOpen = force === undefined ? !elPopOpen : !!force;
    els.elpop.classList.toggle('open', elPopOpen);
    if (elPopOpen) {
      els.elSearch.focus();
      buildElList(els.elSearch.value || '');
    }
  }
  function buildElList(filter) {
    rebuildElementsIfNeeded();
    var f = String(filter || '').trim().toLowerCase();
    var list = [], i;
    for (i = 0; i < ELEMENTS.length; i++) {
      var e = ELEMENTS[i];
      if (!f) { list.push(e); continue; }
      if (e.sym.toLowerCase() === f || e.sym.toLowerCase().indexOf(f) === 0) { list.push(e); continue; }
      if (String(e.z) === f) { list.push(e); continue; }
      if (String(e.name || '').toLowerCase().indexOf(f) >= 0) { list.push(e); continue; }
      if (String(elNameLocal(e) || '').toLowerCase().indexOf(f) >= 0) list.push(e);
    }
    var html = '';
    for (i = 0; i < list.length; i++) {
      var el = list[i];
      html += '<button type="button" data-sym="' + el.sym + '"' +
        (el.sym === ui.el ? ' class="on"' : '') +
        ' title="' + el.z + ' · ' + esc(elNameLocal(el)) + '">' + el.sym + '</button>';
    }
    if (!list.length) html = '<div class="bp-empty">' + esc(tx('unknownEl', { sym: filter })) + '</div>';
    els.ellist.innerHTML = html;
    var btns = els.ellist.querySelectorAll('button');
    for (i = 0; i < btns.length; i++) {
      btns[i].style.color = legible((function (s) {
        var x = elOf(s);
        return x ? (x.ink || x.color) : pal().ink;
      })(btns[i].dataset.sym));
      btns[i].addEventListener('click', function (ev) {
        var sym = ev.currentTarget.dataset.sym;
        if (setElement(sym)) {
          openElPop(false);
          els.elSearch.value = '';
          toast(sym + ' · ' + elNameLocal(elOf(sym)), 'info');
        }
      });
    }
  }
  function esc(s) {
    return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
  }
  // Lucide icon markup for innerHTML strings; hydrated with lucideIn below.
  function ic(name) {
    return '<i data-lucide="' + name + '" class="bp-lc"></i>';
  }
  function lucideIn(root) {
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function')
        window.lucide.createIcons({ nameAttr: 'data-lucide', root: root || document });
    } catch (e) {}
  }
  var elementsFromRegistry = false;
  function rebuildElementsIfNeeded() {
    var a = app();
    var ready = !!(a && a.ELEMENTS && a.ELEMENTS.length);
    if (!ready || elementsFromRegistry) return;
    elementsFromRegistry = true;
    buildElements();
    if (els.elpop && elPopOpen) buildElList(els.elSearch.value || '');
    if (ui.open) refresh();
  }

  // ==========================================================================
  // 9. Pointer + keyboard input.
  // ==========================================================================
  function evPos(e) {
    var r = els.canvas.getBoundingClientRect();
    var sx = e.clientX - r.left, sy = e.clientY - r.top;
    var wx = (sx - ui.pan.x) / ui.zoom, wy = (sy - ui.pan.y) / ui.zoom;
    ui.lastPointer = { x: wx, y: wy };
    return { sx: sx, sy: sy, wx: wx, wy: wy };
  }
  function clampPan() {
    ui.pan.x = Math.max(-4000, Math.min(4000, ui.pan.x));
    ui.pan.y = Math.max(-4000, Math.min(4000, ui.pan.y));
  }

  function componentOf(id) {
    var seen = {}, stack = [id], out = [];
    seen[id] = 1;
    while (stack.length) {
      var x = stack.pop();
      out.push(x);
      var bs = bondsOf(x);
      for (var i = 0; i < bs.length; i++) {
        var o = bs[i].a === x ? bs[i].b : bs[i].a;
        if (!seen[o]) { seen[o] = 1; stack.push(o); }
      }
    }
    return out;
  }
  // A molecule is a piece of matter, not a bag of letters: dragging an atom that is
  // bonded to anything moves its whole fragment and leaves the shape alone. Only an
  // unbonded atom travels on its own.
  function rigidSet(ids) {
    var seen = {}, out = [], i;
    for (i = 0; i < ids.length; i++) seen[ids[i]] = 1;
    for (i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a || !bondsOf(a.id).length) continue;
      var comp = componentOf(a.id);
      for (var j = 0; j < comp.length; j++) seen[comp[j]] = 1;
    }
    for (var k in seen) {
      if (Object.prototype.hasOwnProperty.call(seen, k)) out.push(+k);
    }
    return out;
  }
  // Every atom of the drag sits at its grab-time position plus one shared delta,
  // which is what keeps a molecule rigid.
  function moveBy(d, dx, dy) {
    for (var i = 0; i < d.ids.length; i++) {
      var at = atomById(d.ids[i]);
      var o = d.orig[at && at.id];
      if (!o) continue;
      at.x = o.x + dx;
      at.y = o.y + dy;
    }
  }
  // The joint the dragged fragment is reaching for: an atom of the fragment that
  // sits close to a free joint belonging to an atom outside it. The fragment is
  // translated as a whole so that one atom lands exactly on the joint, which is
  // how a carried -OH finds the carbon it belongs to instead of floating near it.
  function dockForFragment(ids) {
    if (!ui.vsepr) return null;
    var inSet = {}, i, j, best = null;
    for (i = 0; i < ids.length; i++) inSet[ids[i]] = 1;
    for (i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      var js = jointsNear(a.x, a.y, a.sym);
      for (j = 0; j < js.length; j++) {
        var st = atomById(js[j].parent);
        if (!st || inSet[st.id]) continue;
        if (js[j].dist > JOINT_GRAB) continue;
        var score = jointWeight(js[j]);
        if (!best || score < best.score) {
          best = { atom: a.id, x: a.x, y: a.y, joint: js[j], dist: js[j].dist, score: score, parentSym: st.sym };
        }
      }
    }
    return best;
  }
  // Seat the fragment on the joint it is nearest, again by moving every atom of
  // it by the same amount.
  function applyDock(ids) {
    var dock = dockForFragment(ids);
    if (!dock) return null;
    var ex = dock.joint.x - dock.x, ey = dock.joint.y - dock.y;
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (a) { a.x += ex; a.y += ey; }
    }
    return { dock: dock, dx: ex, dy: ey };
  }

  function onPointerDown(e) {
    hideCtx();
    if (e.pointerType === 'touch' && Object.keys(ui.ptrs).length) {
      ui.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      startPinch();
      return;
    }
    ui.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
    try { els.canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is best-effort */ }
    if (e.pointerType === 'mouse') e.preventDefault();
    var p = evPos(e);
    ui.down = { x: e.clientX, y: e.clientY, wx: p.wx, wy: p.wy, shift: e.shiftKey, meta: e.ctrlKey || e.metaKey };
    ui.movedFar = false;
    if (e.button === 1 || ui.tool === 'pan' || ui.space) {
      ui.drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: ui.pan.x, py: ui.pan.y };
      syncCursor();
      return;
    }
    if (e.button === 2) { ui.drag = { mode: 'rmb', sx: e.clientX, sy: e.clientY, px: ui.pan.x, py: ui.pan.y }; return; }

    var va = hitAtom(p.wx, p.wy);
    if (ui.tool === 'select') {
      if (va) {
        if (ui.down.meta || ui.down.shift) selectOnly(va.id, true);
        else if (!selHas(va.id)) selectOnly(va.id, false);
        // Dragging an atom drags its whole fragment: a structure is one piece, and
        // moving a single letter out of it would shear the bonds and every angle
        // the joints were built from.
        ui.drag = {
          mode: 'move', ids: rigidSet(withFoldedH(ui.sel.slice())), wx: p.wx, wy: p.wy,
          anchor: va.id, dx: 0, dy: 0, dock: null, orig: {}, pushed: false
        };
        for (var i = 0; i < ui.drag.ids.length; i++) {
          var at = atomById(ui.drag.ids[i]);
          if (at) ui.drag.orig[at.id] = { x: at.x, y: at.y };
        }
      } else {
        ui.drag = { mode: 'box', x0: p.wx, y0: p.wy, x1: p.wx, y1: p.wy, add: ui.down.shift };
        ui.box = { x0: p.wx, y0: p.wy, x1: p.wx, y1: p.wy };
      }
      syncHint();
      syncButtons();
      return;
    }
    if (ui.tool === 'bond') {
      if (ui.pendingBond && va && ui.pendingBond !== va.id) {
        var from = ui.pendingBond;
        ui.pendingBond = 0;
        actBond(from, va.id, ui.bond);
        return;
      }
      if (va) {
        ui.drag = { mode: 'bond', from: va.id };
        ui.previewBond = { id: va.id, x: p.wx, y: p.wy };
        return;
      }
      ui.drag = { mode: 'bond-new', wx: p.wx, wy: p.wy };
      ui.previewBond = { id: 0, x: p.wx, y: p.wy };
      return;
    }
    // The click-style tools resolve on pointerup so a drag never fires one.
    ui.drag = { mode: 'tap', hit: va ? va.id : null };
  }

  function onPointerMove(e) {
    if (ui.ptrs[e.pointerId]) { ui.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    if (ui.pinch) { updatePinch(); return; }
    var p = evPos(e);
    var hb = hitBond(p.wx, p.wy);
    var ha = hitAtom(p.wx, p.wy);
    var hov = ha ? { type: 'atom', id: ha.id } : (hb ? { type: 'bond', id: hb.id } : null);
    var changed = JSON.stringify(hov) !== JSON.stringify(ui.hover);
    if (changed) { ui.hover = hov; if (!ui.drag) render(); }
    // The joint rings follow the pointer, so an idle move with a drawing tool has
    // to repaint even when nothing is hovered.
    if (!ui.drag && !changed && ui.vsepr && (ui.tool === 'atom' || ui.tool === 'bond')) {
      var lp = ui.lastJointDraw;
      if (!lp || Math.hypot(p.wx - lp.x, p.wy - lp.y) > 5) {
        ui.lastJointDraw = { x: p.wx, y: p.wy };
        render();
      }
    }
    if (ui.down && !ui.movedFar && Math.hypot(e.clientX - ui.down.x, e.clientY - ui.down.y) > 4) ui.movedFar = true;
    if (!ui.drag) return;
    var d = ui.drag;
    if (d.mode === 'pan') {
      ui.pan.x = d.px + (e.clientX - d.sx);
      ui.pan.y = d.py + (e.clientY - d.sy);
      clampPan();
      render();
      return;
    }
    if (d.mode === 'rmb') {
      if (ui.movedFar) {
        d.mode = 'pan';
        d.px = ui.pan.x;
        d.py = ui.pan.y;
        d.sx = e.clientX;
        d.sy = e.clientY;
      }
      return;
    }
    if (d.mode === 'move') {
      if (!d.pushed && ui.movedFar) { beforeChange(); d.pushed = true; }
      var dx = p.wx - d.wx, dy = p.wy - d.wy;
      // One delta for the whole fragment. Snapping atom by atom would scramble the
      // shape into a grid of letters, so the grabbed atom is snapped and everything
      // bonded to it follows at exactly the distance and angle it already had.
      var ao = d.orig && d.orig[d.anchor];
      if (ao && (ui.snap || ui.vsepr)) {
        dx = Math.round((ao.x + dx) / GRID) * GRID - ao.x;
        dy = Math.round((ao.y + dy) / GRID) * GRID - ao.y;
      }
      moveBy(d, dx, dy);
      // Then the joint magnet: if the carried piece is reaching a free joint, it
      // slides the rest of the way onto it so the two structures meet exactly.
      // Alt holds the piece where the hand put it.
      var seat = e.altKey ? null : applyDock(d.ids);
      d.dock = seat ? seat.dock : null;
      d.dx = dx + (seat ? seat.dx : 0);
      d.dy = dy + (seat ? seat.dy : 0);
      render();
      return;
    }
    if (d.mode === 'box') {
      ui.box = { x0: d.x0, y0: d.y0, x1: p.wx, y1: p.wy };
      render();
      return;
    }
    if (d.mode === 'bond' || d.mode === 'bond-new') {
      ui.previewBond = { id: d.from || 0, x: p.wx, y: p.wy };
      render();
      return;
    }
    if (d.mode === 'tap' && ui.tool === 'atom') {
      // dragging with the atom tool paints a chain of bonds
      if (ui.movedFar) {
        ui.previewBond = { id: d.hit || 0, x: p.wx, y: p.wy };
        render();
      }
    }
  }

  function onPointerUp(e) {
    delete ui.ptrs[e.pointerId];
    if (ui.pinch) { endPinch(); return; }
    try { els.canvas.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    var p = evPos(e);
    var d = ui.drag;
    ui.drag = null;
    ui.previewBond = null;
    ui.down = null;
    if (!d) return;
    if (d.mode === 'rmb') {
      if (!ui.movedFar) openCtx(e.clientX, e.clientY);
      else scheduleSave();
      syncCursor();
      render();
      return;
    }
    if (d.mode === 'pan') { scheduleSave(); syncCursor(); render(); return; }
    if (d.mode === 'move') {
      if (d.pushed) {
        afterChange();
        if (d.dock) toast(tx('dockedJoint', { a: d.dock.parentSym }), 'info');
        else if (d.ids.length > 1) toast(tx('dragRigid', { n: d.ids.length }), 'info');
      }
      ui.box = null;
      render();
      syncButtons();
      return;
    }
    if (d.mode === 'box') {
      var x0 = Math.min(d.x0, p.wx), x1 = Math.max(d.x0, p.wx);
      var y0 = Math.min(d.y0, p.wy), y1 = Math.max(d.y0, p.wy);
      ui.box = null;
      if (!ui.movedFar) {
        // The shipped game lowers a bond on a plain click, so the select tool does
        // the same on an unmoved click over a bond; Shift raises it.
        var sb = hitBond(p.wx, p.wy);
        if (sb) { if (e.shiftKey) actCycleBondUp(sb); else actCycleBondDown(sb); return; }
        clearSel(); syncButtons(); render(); return;
      }
      if (!d.add) ui.sel = [];
      if (!view) buildView();
      for (var i = 0; i < view.atoms.length; i++) {
        var v = view.atoms[i];
        if (v.x >= x0 && v.x <= x1 && v.y >= y0 && v.y <= y1 && ui.sel.indexOf(v.id) < 0) ui.sel.push(v.id);
      }
      afterChangeNoHist();
      return;
    }
    if (d.mode === 'bond') {
      var tb = hitAtom(p.wx, p.wy);
      if (tb && tb.id !== d.from) { actBond(d.from, tb.id, ui.bond); ui.pendingBond = 0; return; }
      if (!tb && ui.movedFar) {
        var hb = hitBond(p.wx, p.wy);
        if (hb) { if (e.shiftKey) actCycleBondUp(hb); else actCycleBondDown(hb); return; }
        actBondToNew(d.from, p.wx, p.wy, ui.bond);
        ui.pendingBond = 0;
        return;
      }
      if (!tb && !ui.movedFar) {
        ui.pendingBond = d.from;
        syncHint();
        render();
        return;
      }
      render();
      return;
    }
    if (d.mode === 'bond-new') {
      // The bond tool was pressed on empty canvas: a drag draws a whole new bond,
      // a plain click just drops one atom.
      var endHit = hitAtom(p.wx, p.wy);
      if (!ui.movedFar) { actPlaceAtom(d.wx, d.wy, e.altKey); return; }
      actNewBondDrag(d.wx, d.wy, p.wx, p.wy, endHit, ui.bond);
      return;
    }
    if (d.mode === 'tap') {
      var target = d.hit == null ? null : d.hit;
      if (target === null) { var th = hitAtom(p.wx, p.wy); target = th ? th.id : null; }
      var pt3 = { x: p.wx, y: p.wy };
      if (ui.tool === 'atom') {
        if (!ui.movedFar) {
          if (target) {
            var at3 = atomById(target);
            if (at3 && at3.sym !== ui.el) {
              beforeChange();
              at3.sym = ui.el;
              // Painting a new element onto an atom changes what its bonds are
              // allowed to be, so the board is re-audited the way a loaded file
              // is: a line the new atom cannot hold is corrected, not kept.
              var notes = repairBoard();
              afterChange();
              toast(tx('placed', { sym: ui.el }) + (notes.length ? ' — ' +
                repairedNote('presetRepairedOne', 'presetRepaired', notes.length) + ': ' + notes.join('; ') : ''),
                notes.length ? 'err' : 'ok');
            } else {
              var grown = e.altKey ? null : jointUnderAtom(p.wx, p.wy, ui.el, target);
              if (grown) placeFromJoint(grown);
              else { selectOnly(target, false); syncButtons(); }
            }
          } else actPlaceAtom(pt3.x, pt3.y, e.altKey);
        } else if (d.hit) {
          var endA = hitAtom(p.wx, p.wy);
          if (endA && endA.id !== d.hit) actBond(d.hit, endA.id, 1);
        }
        return;
      }
      if (ui.tool === 'charge-p' || ui.tool === 'charge-m') {
        actChargeBatch(target !== null ? [target] : ui.sel.slice(), ui.tool === 'charge-p' ? 1 : -1);
        return;
      }
      if (ui.tool === 'lp-p' || ui.tool === 'lp-m') {
        actLonePairBatch(target !== null ? [target] : ui.sel.slice(), ui.tool === 'lp-p' ? 1 : -1);
        return;
      }
      if (ui.tool === 'erase') {
        if (target !== null) actEraseAt(target, null);
        else {
          var bHit = hitBond(p.wx, p.wy);
          if (bHit) actEraseAt(null, bHit);
          else if (ui.sel.length) actDeleteSel();
          else actEraseAt(null, null);
        }
        return;
      }
      if (ui.tool === 'bracket') {
        if (target !== null) selectOnly(target, false);
        if (!ui.sel.length) { toast(tx('nothingSel'), 'err'); return; }
        actBracket();
        return;
      }
    }
  }
  // Selection-only change: the document itself is untouched, so history stays put.
  function afterChangeNoHist() {
    scheduleSave();
    refresh();
  }
  function onUpCommon(e) {
    delete ui.ptrs[e.pointerId];
    ui.drag = null;
    ui.previewBond = null;
    render();
  }

  function startPinch() {
    var ids = Object.keys(ui.ptrs);
    if (ids.length < 2) return;
    var a = ui.ptrs[ids[0]], b = ui.ptrs[ids[1]];
    ui.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, z: ui.zoom };
    ui.drag = null;
    ui.box = null;
    ui.previewBond = null;
  }
  function updatePinch() {
    var ids = Object.keys(ui.ptrs);
    if (ids.length < 2 || !ui.pinch) return;
    var a = ui.ptrs[ids[0]], b = ui.ptrs[ids[1]];
    var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    var r = els.canvas.getBoundingClientRect();
    var mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
    var want = Math.min(4, Math.max(0.2, ui.pinch.z * d / ui.pinch.d));
    var w0 = (mx - ui.pan.x) / ui.zoom, w1 = (my - ui.pan.y) / ui.zoom;
    ui.zoom = want;
    ui.pan.x = mx - w0 * want;
    ui.pan.y = my - w1 * want;
    render();
  }
  function endPinch() {
    if (Object.keys(ui.ptrs).length < 2) { ui.pinch = null; scheduleSave(); }
  }

  function onWheel(e) {
    e.preventDefault();
    var p = evPos(e);
    if (e.ctrlKey || e.metaKey) { zoomAt(Math.exp(-e.deltaY * 0.01), p.sx, p.sy); return; }
    if (e.shiftKey && Math.abs(e.deltaX) < 1) { ui.pan.x -= e.deltaY; clampPan(); scheduleSave(); render(); return; }
    ui.pan.x -= e.deltaX;
    ui.pan.y -= e.deltaY;
    clampPan();
    scheduleSave();
    render();
  }

  // ==========================================================================
  // 10. Keyboard. The handler runs in the capture phase on the document and stops
  //     every key it claims, so the game's own WASD / hotkey listener never sees a
  //     keystroke meant for the editor. Typing in a field is left alone.
  // ==========================================================================
  var TOOL_KEYS = { v: 'select', a: 'atom', b: 'bond', e: 'erase', p: 'pan' };

  function typingIn(t) {
    if (!t || !t.tagName) return false;
    var tag = String(t.tagName).toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t.isContentEditable;
  }
  function claim(e) { e.preventDefault(); e.stopPropagation(); }

  // Charge / lone-pair for a whole selection in one history step and one toast.
  function actChargeBatch(ids, delta) {
    var done = [];
    beforeChange();
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      a.q = Math.max(-8, Math.min(8, (a.q || 0) + delta));
      done.push(a);
    }
    if (!done.length) { ui.hist.pop(); toast(tx('nothingSel'), 'err'); return; }
    afterChange();
    toast(done.length === 1 ? tx('chargeSet', { sym: done[0].sym, q: signed(done[0].q) })
      : tx('menuApplySel', { n: done.length }) + ' · ' + signed(delta), 'ok');
  }
  function actLonePairBatch(ids, delta) {
    var done = [];
    beforeChange();
    for (var i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      var want = lpCount(a) + delta;
      if (want < 0) continue;
      setLP(a, want);
      done.push(a);
    }
    if (!done.length) { ui.hist.pop(); toast(tx('lpNone'), 'err'); return; }
    afterChange();
    toast(done.length === 1 ? tx('lpSet', { sym: done[0].sym, n: done[0].lp })
      : tx('menuApplySel', { n: done.length }) + ' · ' + (delta > 0 ? '+' : '−') + 'lp', 'ok');
  }
  function actSelectAll() {
    if (!doc.atoms.length) { toast(tx('emptyDoc'), 'err'); return; }
    ui.sel = withFoldedH(doc.atoms.map(function (a) { return a.id; }));
    afterChangeNoHist();
  }
  function nudgeSel(dx, dy, noDock) {
    if (!ui.sel.length) {
      ui.pan.x += dx; ui.pan.y += dy;
      clampPan(); scheduleSave(); render();
      return;
    }
    var ids = rigidSet(withFoldedH(ui.sel.slice())), moved = 0, i;
    beforeChange();
    for (i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      a.x += dx; a.y += dy;
      moved++;
    }
    if (!moved) { ui.hist.pop(); return; }
    // The fine step is the one that means "exactly here", so Alt skips the joint
    // magnet the same way it skips it for a drag.
    if (!noDock) applyDock(ids);
    afterChange();
  }
  function resetZoom() {
    var r = els.canvasWrap.getBoundingClientRect();
    var bb = viewBBox();
    ui.zoom = 1;
    ui.pan.x = r.width / 2 - (bb.x + bb.w / 2);
    ui.pan.y = r.height / 2 - (bb.y + bb.h / 2);
    clampPan(); scheduleSave(); render();
  }
  function pasteOffset() {
    if (!ui.clip || !ui.clip.atoms.length) return null;
    var c = ui.lastPointer || null, sx = 0, sy = 0, n = ui.clip.atoms.length, i;
    for (i = 0; i < n; i++) { sx += ui.clip.atoms[i].x; sy += ui.clip.atoms[i].y; }
    sx /= n; sy /= n;
    if (!c) return { x: GRID, y: GRID };
    return { x: c.x - sx, y: c.y - sy };
  }
  // Esc closes the topmost thing that is open, and only then the panel.
  function dismissTop() {
    if (els.ctx.classList.contains('open')) { hideCtx(); return true; }
    if (elPopOpen) { openElPop(false); return true; }
    if (ui.help) { toggleHelp(false); return true; }
    if (els.io.classList.contains('open')) { hideIo(); return true; }
    if (ui.sel.length) { clearSel(); refresh(); return true; }
    return false;
  }

  function onKey(e) {
    if (!ui.open) return;
    var t = e.target || null;
    if (typingIn(t)) {
      if (e.key === 'Escape') {
        if (t === els.elSearch) { els.elSearch.value = ''; openElPop(false); }
        else if (els.io.contains(t)) hideIo();
        try { t.blur(); } catch (err) { /* already gone */ }
        e.stopPropagation();
      }
      return;
    }
    var inPanel = !!(els.panel && t && els.panel.contains && els.panel.contains(t));
    var loose = !t || t === document.body || t === document.documentElement ||
      t === els.canvas || t === els.head;
    if (!inPanel && !loose) return;
    var k = e.key, lk = String(k).toLowerCase(), mod = !!(e.ctrlKey || e.metaKey);

    if (k === ' ' || k === 'Spacebar') {
      ui.space = true; syncCursor(); claim(e); return;
    }
    if (mod) {
      if (lk === 'z') { claim(e); if (e.shiftKey) redo(); else undo(); return; }
      if (lk === 'y') { claim(e); redo(); return; }
      if (lk === 'c') { claim(e); actCopy(); return; }
      if (lk === 'x') { claim(e); actCut(); return; }
      if (lk === 'v') { claim(e); if (ui.clip) actPaste(pasteOffset()); else toast(tx('nothingPaste'), 'err'); return; }
      if (lk === 'a') { claim(e); actSelectAll(); return; }
      return;
    }
    if (k === 'Delete' || k === 'Backspace') { claim(e); actDeleteSel(); return; }
    if (k === 'Escape') { claim(e); if (!dismissTop()) close(); return; }
    if (k === 'ArrowUp') { claim(e); nudgeSel(0, e.altKey ? -4 : -GRID, e.altKey); return; }
    if (k === 'ArrowDown') { claim(e); nudgeSel(0, e.altKey ? 4 : GRID, e.altKey); return; }
    if (k === 'ArrowLeft') { claim(e); nudgeSel(e.altKey ? -4 : -GRID, 0, e.altKey); return; }
    if (k === 'ArrowRight') { claim(e); nudgeSel(e.altKey ? 4 : GRID, 0, e.altKey); return; }
    if (k === '+' || k === '=') { claim(e); zoomStep(1.25); return; }
    if (k === '-' || k === '_') { claim(e); zoomStep(0.8); return; }
    if (k === '0') { claim(e); resetZoom(); return; }
    if (k === '1' || k === '2' || k === '3') { claim(e); setBondOrder(+k); return; }
    if (lk === 'f') { claim(e); actFit(); return; }
    if (lk === 'g') { claim(e); setGrid(!ui.grid); return; }
    if (lk === 's') { claim(e); ui.snap = !ui.snap; toast(ui.snap ? tx('snapOn') : tx('snapOff'), 'info'); scheduleSave(); syncButtons(); return; }
    if (lk === 'h') { claim(e); ui.showH = !ui.showH; scheduleSave(); refresh(); return; }
    if (lk === 'k' || lk === 'l') { claim(e); actChargeBatch(ui.sel.slice(), lk === 'k' ? 1 : -1); return; }
    if (k === '[' || k === ']') { claim(e); actLonePairBatch(ui.sel.slice(), k === ']' ? 1 : -1); return; }
    if (TOOL_KEYS[lk]) { claim(e); setTool(TOOL_KEYS[lk]); return; }
  }
  function onKeyUp(e) {
    if (e.key === ' ' || e.key === 'Spacebar') { ui.space = false; if (ui.open) syncCursor(); }
  }

  function setGrid(on) {
    ui.grid = !!on;
    ui.snap = !!on;
    scheduleSave();
    refresh();
  }

  // ==========================================================================
  // 11. Right-click (and long-press) menu. Compact, always inside the canvas.
  // ==========================================================================
  var ctxItems = [];

  function hideCtx() {
    if (!els.ctx) return;
    els.ctx.classList.remove('open');
    if (els.ctx.innerHTML) els.ctx.innerHTML = '';
    ctxItems = [];
  }
  function ctxPush(label, run, disabled) {
    if (disabled) return;
    ctxItems.push({ label: label, run: run });
  }
  function openCtx(clientX, clientY) {
    if (!ui.open || ui.min) return;
    var c = els.canvas.getBoundingClientRect();
    var wx = (clientX - c.left - ui.pan.x) / ui.zoom;
    var wy = (clientY - c.top - ui.pan.y) / ui.zoom;
    ui.lastPointer = { x: wx, y: wy };
    var a = hitAtom(wx, wy), b = a ? null : hitBond(wx, wy);
    ctxItems = [];
    var i;
    if (a) {
      selectOnly(a.id, false);
      ctxPush(tx('tChargeP'), function () { actCharge(a.id, 1); });
      ctxPush(tx('tChargeM'), function () { actCharge(a.id, -1); });
      ctxPush(tx('menuLpAdd'), function () { actLonePair(a.id, 1); });
      ctxPush(tx('menuLpRemove'), function () { actLonePair(a.id, -1); });
      ctxPush(tx('menuBracket'), function () { actBracket(); });
      ctxPush(tx('menuErase'), function () { actEraseAt(a.id, null); });
    } else if (b) {
      ctxPush(tx('menuRaise'), function () { actCycleBondUp(b); });
      ctxPush(tx('menuLower'), function () { actCycleBondDown(b); });
      ctxPush(tx('menuDeleteBond'), function () { actEraseAt(null, b); });
    } else {
      ctxPush(tx('menuPasteHere'), function () { actPaste(pasteOffset()); }, !ui.clip || !ui.clip.atoms.length);
      ctxPush(tx('selectAll'), actSelectAll, !doc.atoms.length);
      ctxPush(tx('addH'), actAddHydrogens, !doc.atoms.length);
      ctxPush(tx('clean'), actCleanLayout, !doc.atoms.length);
      ctxPush(tx('fit'), actFit, !doc.atoms.length);
      for (i = 0; i < PRESETS.length; i++) ctxPush(tx(PRESETS[i].key), bindPreset(PRESETS[i].id));
      ctxPush(tx('menuClear'), actClearAll, !doc.atoms.length);
    }
    if (!ctxItems.length) { hideCtx(); return; }
    var html = '';
    for (i = 0; i < ctxItems.length; i++) {
      html += '<button type="button" data-ci="' + i + '">' + esc(ctxItems[i].label) + '</button>';
    }
    els.ctx.innerHTML = html;
    els.ctx.classList.add('open');
    var wr = els.canvasWrap.getBoundingClientRect();
    var mw = els.ctx.offsetWidth || 160, mh = els.ctx.offsetHeight || ctxItems.length * 26;
    els.ctx.style.left = Math.max(4, Math.min(wr.width - mw - 6, clientX - wr.left)) + 'px';
    els.ctx.style.top = Math.max(4, Math.min(wr.height - mh - 6, clientY - wr.top)) + 'px';
    refresh();
  }
  function onCtxClick(e) {
    var b = e.target && e.target.closest ? e.target.closest('button[data-ci]') : null;
    if (!b) return;
    var it = ctxItems[+b.dataset.ci];
    hideCtx();
    if (it && it.run) it.run();
  }

  // ==========================================================================
  // 11b. Quick-build presets. Real molecules, real Lewis features: the water is
  //      bent with two lone pairs on oxygen, the nitrate carries its formal
  //      charges and its bracket, the ring presets are rings.
  // ==========================================================================
  function hexRingPositions(r) {
    var out = [], i;
    for (i = 0; i < 6; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 3;
      out.push({ x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) });
    }
    return out;
  }
  function radialH(atoms, r) {
    var out = [], i;
    for (i = 0; i < atoms.length; i++) {
      var a = Math.atan2(atoms[i].y, atoms[i].x);
      out.push({ sym: 'H', x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) });
    }
    return out;
  }
  var PRESETS = [
    {
      id: 'water', key: 'presetWater', make: function () {
        return {
          atoms: [
            { sym: 'O', x: 0, y: -30, lp: 2 },
            { sym: 'H', x: -86, y: 30 },
            { sym: 'H', x: 86, y: 30 }
          ],
          bonds: [[0, 1, 1], [0, 2, 1]]
        };
      }
    },
    {
      id: 'benzene', key: 'presetBenzene', make: function () {
        var c = hexRingPositions(BOND_LEN / 2), h = radialH(c, BOND_LEN * 1.5), i;
        for (i = 0; i < c.length; i++) c[i].sym = 'C';
        var atoms = c.concat(h), bonds = [];
        for (i = 0; i < 6; i++) bonds.push([i, (i + 1) % 6, i % 2 === 0 ? 2 : 1]);
        for (i = 0; i < 6; i++) bonds.push([i, 6 + i, 1]);
        return { atoms: atoms, bonds: bonds };
      }
    },
    {
      id: 'cyclohexane', key: 'presetCyclohexane', addH: true, make: function () {
        var c = hexRingPositions(BOND_LEN / 2), bonds = [], i;
        for (i = 0; i < c.length; i++) { c[i].sym = 'C'; bonds.push([i, (i + 1) % 6, 1]); }
        return { atoms: c, bonds: bonds };
      }
    },
    {
      id: 'ethanol', key: 'presetEthanol', addH: true, make: function () {
        return {
          atoms: [{ sym: 'C', x: -BOND_LEN, y: 20 }, { sym: 'C', x: 0, y: -20 }, { sym: 'O', x: BOND_LEN, y: 20 }],
          bonds: [[0, 1, 1], [1, 2, 1]]
        };
      }
    },
    {
      id: 'nitrate', key: 'presetNitrate', bracket: true, make: function () {
        var r = BOND_LEN + 8, i, atoms = [{ sym: 'N', x: 0, y: 0, q: 1 }], bonds = [];
        for (i = 0; i < 3; i++) {
          var a = -Math.PI / 2 + i * 2 * Math.PI / 3;
          atoms.push({
            sym: 'O', x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r),
            q: i === 0 ? 0 : -1, lp: i === 0 ? 2 : 3
          });
          bonds.push([0, i + 1, i === 0 ? 2 : 1]);
        }
        return { atoms: atoms, bonds: bonds };
      }
    }
  ];
  function applyPreset(id) {
    var p = null, i;
    for (i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) p = PRESETS[i];
    if (!p) return false;
    var s = p.make();
    beforeChange();
    doc.atoms = []; doc.bonds = []; doc.brackets = []; doc.nextId = 1; ui.sel = [];
    var ids = [], made = [];
    for (i = 0; i < s.atoms.length; i++) {
      var d = s.atoms[i];
      var a = makeAtom(d.sym, d.x, d.y);
      a.q = d.q || 0;
      ids.push(a.id);
      made.push(a);
    }
    for (i = 0; i < s.bonds.length; i++) {
      addBond(ids[s.bonds[i][0]], ids[s.bonds[i][1]], s.bonds[i][2] || 1);
    }
    // Lone pairs are the engine's bookkeeping; a preset only states them when it
    // means something other than what the electrons alone would give, and once the
    // bonds exist - otherwise the count would be read against an empty atom.
    for (i = 0; i < made.length; i++) {
      if (s.atoms[i].lp !== undefined) setLP(made[i], s.atoms[i].lp);
    }
    // A preset is a claim about a real molecule, so it is held to the same rules as
    // anything drawn by hand; if one of these ever fails the audit, the board says so.
    var fixNotes = repairBoard();
    afterChange();
    if (p.addH) actAddHydrogens();
    if (p.bracket) { ui.sel = ids.slice(); actBracket(); ui.sel = []; refresh(); }
    actFit();
    toast(tx('loadedPreset', { name: tx(p.key) }) +
      (fixNotes.length ? ' — ' + repairedNote('presetRepairedOne', 'presetRepaired', fixNotes.length) + ': ' + fixNotes.join('; ') : ''),
      fixNotes.length ? 'err' : 'ok');
    return true;
  }
  function bindPreset(id) { return function () { applyPreset(id); }; }
  function actClearAll() {
    if (!doc.atoms.length) { toast(tx('emptyDoc'), 'err'); return; }
    beforeChange();
    doc.atoms = []; doc.bonds = []; doc.brackets = []; ui.sel = [];
    afterChange();
    toast(tx('cleared'), 'ok');
  }

  // ==========================================================================
  // 12. Help card. It is built from the live toolbar and footer, so the text can
  //     never drift from the buttons and it is bilingual for free.
  // ==========================================================================
  var KEY_ROWS = [
    ['Ctrl + Z / Ctrl + Y', 'kUndo'],
    ['Ctrl + C / X / V', 'kClip'],
    ['Ctrl + A', 'kAll'],
    ['Del', 'kDel'],
    ['V / A / B / E / P', 'kToolKeys'],
    ['1 / 2 / 3', 'kOrderKeys'],
    ['F', 'kFitKey'],
    ['0 / + / −', 'kZoomKeys'],
    ['G', 'kGridKey'],
    ['S', 'kSnapKey'],
    ['H', 'kHKey'],
    ['K / L', 'kChargeKeys'],
    ['[ / ]', 'kLpKeys'],
    ['Alt', 'kAltKey'],
    ['↑ ↓ ← →', 'kNudgeKeys'],
    ['Space / Ctrl + wheel', 'kSpaceKey'],
    ['Esc', 'kEscKey']
  ];
  function helpList(items) {
    var html = '<ul>', i;
    for (i = 0; i < items.length; i++) html += '<li>' + items[i] + '</li>';
    return html + '</ul>';
  }
  function renderHelp() {
    if (!els.helpBody) return;
    var i, b, items = [];
    var tools = els.rail.querySelectorAll('.bp-tool');
    for (i = 0; i < tools.length; i++) {
      b = tools[i];
      items.push('<kbd>' + esc(b.textContent) + '</kbd> — ' + esc(b.title));
    }
    var html = '<h5>' + esc(tx('helpSecTools')) + '</h5>' + helpList(items);
    items = [];
    for (i = 0; i < els.foot.children.length; i++) {
      b = els.foot.children[i];
      if (!b.dataset || !b.dataset.act) continue;
      items.push('<b>' + esc(b.textContent) + '</b> — ' + esc(b.title));
    }
    html += '<h5>' + esc(tx('helpSecActions')) + '</h5>' + helpList(items);
    items = [];
    for (i = 0; i < KEY_ROWS.length; i++) {
      items.push('<kbd>' + esc(KEY_ROWS[i][0]) + '</kbd> — ' + esc(tx(KEY_ROWS[i][1])));
    }
    html += '<h5>' + esc(tx('helpSecKeys')) + '</h5>' + helpList(items);
    html += '<h5>' + esc(tx('helpSecGeometry')) + '</h5><p>' + esc(tx('geomNote')) + '</p>';
    items = [];
    for (i = 0; i < PRESETS.length; i++) items.push(esc(tx(PRESETS[i].key)));
    html += '<h5>' + esc(tx('helpSecPresets')) + '</h5>' + helpList(items);
    html += '<h5>' + esc(tx('helpSecExport')) + '</h5><p>' + esc(tx('helpExportNote')) + '</p>';
    els.helpBody.innerHTML = html;
  }
  function toggleHelp(on) {
    ui.help = on === undefined ? !ui.help : !!on;
    els.helpCard.classList.toggle('open', ui.help);
    if (ui.help) renderHelp();
    syncButtons();
  }

  // ==========================================================================
  // 13. Text and image export.
  // ==========================================================================
  function formulaText() {
    var groups = formulaTerms(), parts = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], s = g.n > 1 ? g.n + ' ' : '';
      for (var j = 0; j < g.terms.length; j++) s += g.terms[j].t + (g.terms[j].n > 1 ? g.terms[j].n : '');
      if (g.q) s += ' ' + signed(g.q);
      parts.push(s);
    }
    return parts.join(' + ');
  }

  function downloadUrl(href, name) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    try { a.click(); } catch (e) { /* a blocked download still leaves the text sheet */ }
    window.setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 800);
  }

  function pngCanvas(targetPx) {
    if (!doc.atoms.length || !els.canvas) return null;
    buildView();
    var bb = viewBBox(), pad = GRID;
    var w = Math.max(1, bb.w + pad * 2), h = Math.max(1, bb.h + pad * 2);
    var target = Math.max(320, Math.min(2600, Math.round(targetPx || 1200)));
    var k = target / Math.max(w, h);
    var cw = Math.max(64, Math.round(w * k)), ch = Math.max(64, Math.round(h * k));
    var c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    var ctx = c.getContext('2d');
    if (!ctx) return null;
    paint(ctx, cw, ch, 1, { x: cw / 2 - (bb.x + bb.w / 2) * k, y: ch / 2 - (bb.y + bb.h / 2) * k, z: k }, true);
    return c;
  }
  function toPngDataUrl(targetPx) {
    var c = pngCanvas(targetPx);
    if (!c) return '';
    try { return c.toDataURL('image/png'); } catch (e) { return ''; }
  }
  function exportPNG() {
    if (!doc.atoms.length) { toast(tx('emptyDoc'), 'err'); return; }
    var url = toPngDataUrl(1200);
    if (!url) { toast(tx('exportBroken', { reason: 'PNG' }), 'err'); return; }
    downloadUrl(url, 'blueprint.png');
    toast(tx('pngDone'), 'ok');
  }

  // ---- MOL V2000 ----------------------------------------------------------
  function v2f(x) { var s = x.toFixed(4); while (s.length < 10) s = ' ' + s; return s.slice(-10); }
  function v2i(n, w) { var s = String(n); while (s.length < w) s = ' ' + s; return s.slice(-w); }
  function ljust(s, w) { s = String(s); while (s.length < w) s += ' '; return s; }
  function toMol() {
    var idx = {}, i, lines = [];
    for (i = 0; i < doc.atoms.length; i++) idx[doc.atoms[i].id] = i + 1;
    var bl = [];
    for (i = 0; i < doc.bonds.length; i++) {
      var b = doc.bonds[i];
      if (!idx[b.a] || !idx[b.b]) continue;
      // Type 8 is the V2000 code for a coordination/ionic link: the electrons were
      // transferred, not shared, and a MolFile must not claim otherwise.
      bl.push([idx[b.a], idx[b.b], b.ionic ? 8 : Math.max(1, Math.min(7, b.order || 1))]);
    }
    lines.push('  MOLECULITH BLUEPRINT');
    lines.push('  2D structural drawing from the in-game editor');
    lines.push('');
    lines.push(v2i(doc.atoms.length, 3) + v2i(bl.length, 3) + '  0    0    0  0  0  0  0  0999 V2000');
    for (i = 0; i < doc.atoms.length; i++) {
      var a = doc.atoms[i];
      lines.push(v2f(a.x * ANG_PER_PX) + v2f(-a.y * ANG_PER_PX) + v2f(0) + ' ' + ljust(a.sym, 3) +
        '  0  0  0  0  0  0  0  0  0  0  0  0');
    }
    for (i = 0; i < bl.length; i++) {
      lines.push(v2i(bl[i][0], 3) + v2i(bl[i][1], 3) + v2i(bl[i][2], 3) + '  1  0  0  0  0  0');
    }
    var chg = [];
    for (i = 0; i < doc.atoms.length; i++) {
      if (doc.atoms[i].q) chg.push([idx[doc.atoms[i].id], doc.atoms[i].q]);
    }
    for (i = 0; i < chg.length; i += 3) {
      var slice = chg.slice(i, i + 3);
      var line = 'M  CHG' + v2i(slice.length, 3);
      for (var j = 0; j < slice.length; j++) line += v2i(slice[j][0], 3) + v2i(slice[j][1], 4);
      lines.push(line);
    }
    lines.push('M  END');
    return lines.join('\n') + '\n';
  }

  // ---- SMILES -------------------------------------------------------------
  // Connectivity, bond orders and formal charges, with the hydrogens that hang
  // off one heavy atom folded into it (B,H2 → BH2) and a bond the engine called
  // ionic written as the salt dot, exactly the way real SMILES writes NaCl. Lone
  // pairs are not part of SMILES: the reader re-derives them from the valence,
  // and a bond order above three has no SMILES symbol, so it is written as a
  // triple bond.
  function paulingIonic(A, B) {
    var ea = elOf(A.sym), eb = elOf(B.sym);
    if (!ea || !eb) return false;
    var d = ea.en && eb.en ? Math.abs(ea.en - eb.en) : 0;
    return d > 1.7;
  }
  // The bond record is the authority: `bondPlan` asked the engine which kind of
  // bond this is and the answer was stored. The Pauling gap only stands in for
  // documents saved before the flag existed.
  function isIonicBond(bond, A, B) {
    if (bond && typeof bond.ionic === 'boolean') return bond.ionic;
    return !!A && !!B && paulingIonic(A, B);
  }
  function smilesNeighbors(id, skipIonic) {
    var out = [], at = atomById(id), bs = bondsOf(id), i;
    if (!at) return out;
    for (i = 0; i < bs.length; i++) {
      var other = atomById(bs[i].a === id ? bs[i].b : bs[i].a);
      if (!other) continue;
      if (skipIonic && isIonicBond(bs[i], at, other)) continue;
      out.push({ id: other.id, order: Math.max(1, Math.min(3, bs[i].order || 1)), bond: bs[i] });
    }
    // a deterministic order keeps the same drawing on the same string
    out.sort(function (x, y) { return x.id - y.id; });
    return out;
  }
  function smilesAromatic() {
    var atoms = {}, bonds = {}, i, j;
    var keys = ringBonds();
    for (i = 0; i < keys.length; i++) {
      var parts = keys[i].split('-');
      var bond = bondBetween(+parts[0], +parts[1]);
      if (!bond) continue;
      var p = pathBetween(bond.a, bond.b, bond.id);
      if (!p || p.atoms.length !== 6) continue;
      var orders = [], ringB = p.bonds.concat([bond]);
      for (j = 0; j < ringB.length; j++) orders.push(Math.max(1, ringB[j].order || 1));
      if (ringB.length !== 6) continue;
      var ok = true, doubles = 0;
      for (j = 0; j < 6; j++) {
        var at = atomById(p.atoms[j]);
        if (!at || at.sym !== 'C') ok = false;
        if (orders[j] === 2) doubles++;
        if (orders[j] > 2) ok = false;
      }
      if (!ok || doubles !== 3) continue;
      for (j = 0; j < 6; j++) if ((orders[j] === 2) === (orders[(j + 1) % 6] === 2)) ok = false;
      if (!ok) continue;
      for (j = 0; j < 6; j++) {
        var id = p.atoms[j];
        var ringOrders = orders[j] + orders[(j + 5) % 6];
        if (orderSum(id) - ringOrders > 1) { ok = false; break; }
      }
      if (!ok) continue;
      for (j = 0; j < 6; j++) { atoms[p.atoms[j]] = 1; bonds[ringB[j].id] = 1; }
    }
    return { atoms: atoms, bonds: bonds };
  }
  function pathBetween(from, to, blockedBondId) {
    var prev = {}, prevBond = {}, seen = {}, q = [from], head = 0, i;
    seen[from] = 1;
    while (head < q.length) {
      var u = q[head++];
      if (u === to) break;
      var bs = bondsOf(u);
      for (i = 0; i < bs.length; i++) {
        if (bs[i].id === blockedBondId) continue;
        var v = bs[i].a === u ? bs[i].b : bs[i].a;
        if (seen[v]) continue;
        seen[v] = 1; prev[v] = u; prevBond[v] = bs[i]; q.push(v);
      }
    }
    if (!seen[to]) return null;
    var atoms = [], bonds = [], cur = to;
    while (cur !== from && cur !== undefined) {
      atoms.push(cur);
      bonds.push(prevBond[cur]);
      cur = prev[cur];
    }
    if (cur !== from) return null;
    atoms.push(from);
    atoms.reverse();
    bonds.reverse();
    return { atoms: atoms, bonds: bonds };
  }
  function ringLabel(n) { return n < 10 ? String(n) : '%' + (n < 100 ? '0' + n : n); }
  function chargeToken(q) {
    if (!q) return '';
    var mag = Math.abs(q) > 1 ? String(Math.abs(q)) : '';
    return (q > 0 ? '+' : '-') + mag;
  }
  function toSmiles() {
    if (!doc.atoms.length) return '';
    var arom = smilesAromatic();
    // An ionic bond leaves the string as the salt dot, so its electron pair has
    // to reappear as the charges it really is: the more electronegative end takes
    // the minus. Atoms whose charge the drawing already states are left alone.
    var derivedQ = {}, bi;
    for (bi = 0; bi < doc.bonds.length; bi++) {
      var bd = doc.bonds[bi], BA = atomById(bd.a), BB = atomById(bd.b);
      if (!BA || !BB || !isIonicBond(bd, BA, BB)) continue;
      if ((BA.q || 0) || (BB.q || 0)) continue;
      var ea = elOf(BA.sym), eb = elOf(BB.sym);
      var xa = ea && ea.en ? ea.en : 0, xb = eb && eb.en ? eb.en : 0;
      var neg = xa >= xb ? BA : BB, pos = neg === BA ? BB : BA;
      var bo = Math.max(1, bd.order || 1);
      derivedQ[pos.id] = (derivedQ[pos.id] || 0) + bo;
      derivedQ[neg.id] = (derivedQ[neg.id] || 0) - bo;
    }
    // terminal hydrogens folded into the heavy atom they hang off
    var folded = {}, foldCount = {}, i, j;
    for (i = 0; i < doc.atoms.length; i++) {
      var h = doc.atoms[i];
      if (h.sym !== 'H') continue;
      var bs = bondsOf(h.id);
      if (bs.length !== 1 || (h.q || 0) !== 0 || (h.lp || 0) !== 0) continue;
      var p = atomById(bs[0].a === h.id ? bs[0].b : bs[0].a);
      if (!p || p.sym === 'H') continue;
      if (Math.max(1, bs[0].order || 1) !== 1) continue;
      if (isIonicBond(bs[0], p, h)) continue;
      folded[h.id] = 1;
      foldCount[p.id] = (foldCount[p.id] || 0) + 1;
    }
    function token(id) {
      var a = atomById(id);
      var q = (a.q || 0) + (derivedQ[id] || 0), nH = foldCount[id] || 0;
      var isAro = !!arom.atoms[id];
      var sym = isAro ? String(a.sym).toLowerCase() : a.sym;
      var organic = !!ORGANIC[a.sym] && !isAro;
      if (isAro) organic = true;
      // A bare organic symbol carries SMILES' own hydrogen count: use it when the
      // drawing states the same number, or when it states none at all and the
      // skeletal convention should fill them in. Any other count is bracketed.
      if (organic && !q && (nH === 0 || nH === implicitH(id))) return sym;
      return '[' + sym + (nH > 0 ? 'H' + (nH > 1 ? nH : '') : '') + chargeToken(q) + ']';
    }
    function implicitH(id) {
      var a = atomById(id), nb = smilesNeighbors(id, true), D = 0, k;
      for (k = 0; k < nb.length; k++) if (!folded[nb[k].id]) D += nb[k].order;
      return Math.max(0, (STD_V[a.sym] || 0) - D);
    }
    function bondSym(bondId, order) {
      if (arom.bonds[bondId]) return '';
      return order >= 3 ? '#' : order === 2 ? '=' : '';
    }
    var ctx = { rc: 0 };
    function fragment(start) {
      var seen = {}, onStack = {}, kids = {}, opens = {}, closes = {};
      function walk(u, parent) {
        seen[u] = 1; onStack[u] = 1;
        kids[u] = [];
        var nb = smilesNeighbors(u, true), i2;
        for (i2 = 0; i2 < nb.length; i2++) {
          var e = nb[i2], v = e.id;
          if (folded[v]) continue;
          if (v === parent) continue;
          if (seen[v]) {
            if (onStack[v]) {
              ctx.rc++;
              (opens[v] = opens[v] || []).push({ d: ctx.rc, order: e.order, bond: e.bond.id });
              (closes[u] = closes[u] || []).push({ d: ctx.rc, order: e.order, bond: e.bond.id });
            }
            continue;
          }
          kids[u].push(e);
          walk(v, u);
        }
        onStack[u] = 0;
      }
      walk(start, 0);
      function emit(u, parent) {
        var s = token(u), i2;
        var op = opens[u] || [];
        for (i2 = 0; i2 < op.length; i2++) s += ringLabel(op[i2].d);
        var cl = closes[u] || [];
        for (i2 = 0; i2 < cl.length; i2++) s += bondSym(cl[i2].bond, cl[i2].order) + ringLabel(cl[i2].d);
        // Only the last branch may run inline; a branch after an inline chain
        // would hang off that chain's end atom instead of off u.
        var kk = (kids[u] || []).filter(function (e) { return e.id !== parent; });
        for (i2 = 0; i2 < kk.length - 1; i2++) {
          var e2 = kk[i2], bs2 = bondSym(e2.bond.id, e2.order);
          s += '(' + bs2 + emit(e2.id, u) + ')';
        }
        if (kk.length) {
          var et = kk[kk.length - 1];
          s += bondSym(et.bond.id, et.order) + emit(et.id, u);
        }
        return s;
      }
      return emit(start, 0);
    }
    // fragments of the covalent subgraph only: the salt dot splits an ionic pair
    var seenF = {}, parts = [], order = doc.atoms.slice().sort(function (x, y) { return x.id - y.id });
    function heavyDegree(id) {
      var nb = smilesNeighbors(id, true), n = 0, k;
      for (k = 0; k < nb.length; k++) if (!folded[nb[k].id]) n++;
      return n;
    }
    for (i = 0; i < order.length; i++) {
      var id = order[i].id;
      if (seenF[id] || folded[id]) continue;
      // mark everything reachable from here (skipping ionic bonds) as used
      var stack = [id], members = [];
      seenF[id] = 1;
      while (stack.length) {
        var u2 = stack.pop();
        members.push(u2);
        var nb2 = smilesNeighbors(u2, true);
        for (j = 0; j < nb2.length; j++) {
          if (folded[nb2[j].id] || seenF[nb2[j].id]) continue;
          seenF[nb2[j].id] = 1;
          stack.push(nb2[j].id);
        }
      }
      // Start the walk at an end of the chain when there is one, so a straight
      // molecule is written straight: O=C=O rather than C(=O)=O.
      members.sort(function (p, q) { return p - q; });
      var start = members[0];
      for (j = 0; j < members.length; j++) {
        if (heavyDegree(members[j]) <= 1) { start = members[j]; break; }
      }
      parts.push(fragment(start));
    }
    return parts.join('.');
  }

  function openIo(kind) {
    if (!doc.atoms.length) { toast(tx('emptyDoc'), 'err'); return; }
    var text = kind === 'mol' ? toMol() : toSmiles();
    if (!text) { toast(tx('exportBroken', { reason: 'SMILES' }), 'err'); return; }
    els.ioText.value = text;
    els.ioTitle.textContent = tx(kind === 'mol' ? 'molHead' : 'smilesHead');
    els.io.dataset.kind = kind;
    els.io.dataset.name = kind === 'mol' ? 'blueprint.mol' : 'blueprint.smiles';
    els.io.classList.add('open');
    els.ioText.disabled = false;
    try { els.ioText.focus(); els.ioText.select(); } catch (e) { /* focus is a courtesy */ }
    syncButtons();
  }
  function hideIo() {
    els.io.classList.remove('open');
    els.ioText.disabled = true;
    syncButtons();
  }
  function ioCopy() {
    var txt = els.ioText.value;
    var report = function (ok) { toast(ok ? tx('textCopied') : tx('copyFailed'), ok ? 'ok' : 'err'); };
    var fallback = function () {
      try {
        els.ioText.focus();
        els.ioText.select();
        report(!!document.execCommand('copy'));
      } catch (e) { report(false); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(txt).then(function () { report(true); }, fallback);
        return;
      } catch (e) { fallback(); return; }
    }
    fallback();
  }
  function ioSave() {
    var txt = els.ioText.value, name = els.io.dataset.name || 'blueprint.txt';
    try {
      var blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      downloadUrl(url, name);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast(tx('download', { name: name }), 'ok');
    } catch (e) { toast(tx('copyFailed'), 'err'); }
  }

  // ==========================================================================
  // 14. Export into the live 3D scene. The registry does not expose the game's
  //     buildMoleculeAt, so this is the same three calls a player makes by hand:
  //     spawnAtom for every atom at a chosen spot, then the game bond rule for
  //     every bond, then the bond order. createBond runs the engine reshape
  //     itself, so the geometry that lands in the scene is the engine's own
  //     VSEPR + FIRE geometry, rings included, not a flattened picture of the
  //     drawing. The drawing is used for the topology and for a fallback
  //     placement when the engine cannot build the structure.
  // ==========================================================================
  var SCENE_MAX_ATOMS = 400;   // MAX_ATOMS in the game bundle
  var WORLD_PER_PX = 0.032;    // one drawing pixel, in world units (0.55 A each)
  var SCENE_MIN_GAP = 3;       // keep at least this much air between molecules

  function num(v) { return typeof v === 'number' && isFinite(v) ? v : 0; }
  function vsub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  function vcross(a, b) {
    return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
  }
  function vlen(a) { return Math.hypot(a.x, a.y, a.z); }
  function vunit(a) { var L = vlen(a) || 1; return { x: a.x / L, y: a.y / L, z: a.z / L }; }
  function clampNum(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function fragData(ids) {
    var index = {}, syms = [], charges = [], i;
    for (i = 0; i < ids.length; i++) {
      var a = atomById(ids[i]);
      if (!a) continue;
      index[a.id] = syms.length;
      syms.push(a.sym);
      charges.push(a.q || 0);
    }
    var bonds = [];
    for (i = 0; i < doc.bonds.length; i++) {
      var b = doc.bonds[i];
      if (index[b.a] === undefined || index[b.b] === undefined) continue;
      bonds.push([index[b.a], index[b.b], Math.max(1, b.order || 1)]);
    }
    return { ids: ids, index: index, syms: syms, charges: charges, bonds: bonds, q: netCharge(ids) };
  }
  function viewBasis() {
    var A = app();
    var fwd = { x: 0, y: -0.4, z: -1 };
    if (A && A.camera && A.camera.position && A.controls && A.controls.target) {
      fwd = vsub(A.controls.target, A.camera.position);
      if (vlen(fwd) < 1e-6) fwd = { x: 0, y: 0, z: -1 };
    }
    fwd = vunit(fwd);
    var upGuess = Math.abs(fwd.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    var right = vunit(vcross(fwd, upGuess));
    var up = vunit(vcross(right, fwd));
    return { fwd: fwd, right: right, up: up };
  }
  function planePoint(ctr, basis, a, b) {
    return {
      x: ctr.x + basis.right.x * a + basis.up.x * b,
      y: ctr.y + basis.right.y * a + basis.up.y * b,
      z: ctr.z + basis.right.z * a + basis.up.z * b
    };
  }
  function clearOfScene(p, spread) {
    var A = app();
    if (!A || !A.atoms) return true;
    var need = spread + SCENE_MIN_GAP;
    var free = true;
    A.atoms.forEach(function (at) {
      if (!free || !at || !at.pos) return;
      if (Math.hypot(at.pos.x - p.x, at.pos.y - p.y, at.pos.z - p.z) < need) free = false;
    });
    return free;
  }
  function findAnchor(spread) {
    var A = app();
    var half = num(A && A.worldHalf) || 120;
    var lim = Math.max(3, half - spread - 3);
    var ctr = A && A.controls && A.controls.target
      ? { x: clampNum(num(A.controls.target.x), -lim, lim), y: clampNum(num(A.controls.target.y), -lim, lim), z: clampNum(num(A.controls.target.z), -lim, lim) }
      : { x: 0, y: 0, z: 0 };
    var basis = viewBasis();
    var cands = [ctr], ring, k, step = Math.max(5, spread * 1.6 + 3);
    for (ring = 1; ring <= 8; ring++) {
      for (k = 0; k < 10; k++) {
        var th = (k / 10) * Math.PI * 2 + ring * 0.31;
        var R = ring * step;
        var p = planePoint(ctr, basis, Math.cos(th) * R, Math.sin(th) * R);
        cands.push({
          x: clampNum(p.x, -lim, lim), y: clampNum(p.y, -lim, lim), z: clampNum(p.z, -lim, lim)
        });
      }
    }
    for (var i = 0; i < cands.length; i++) if (clearOfScene(cands[i], spread)) return cands[i];
    return ctr;
  }
  function enginePositions(f) {
    var P = window.Mol3DPhysics;
    if (!P || !P.Builder || typeof P.Builder.build !== 'function' ||
      !P.SceneBridge || typeof P.SceneBridge.toWorld !== 'function') return null;
    var built = null;
    try {
      built = P.Builder.build({
        atoms: f.syms.map(function (s, i) { return { sym: s, charge: f.charges[i] }; }),
        bonds: f.bonds,
        charge: f.q
      }, { deadlineMs: 220 });
    } catch (e) { return null; }
    if (!built || !built.ok || !built.mol || !built.mol.atoms ||
      built.mol.atoms.length !== f.syms.length) return null;
    var list = built.mol.atoms, i, g = { x: 0, y: 0, z: 0 }, n = list.length;
    for (i = 0; i < n; i++) {
      if (!list[i] || !isFinite(list[i].x) || !isFinite(list[i].y) || !isFinite(list[i].z)) return null;
      g.x += list[i].x; g.y += list[i].y; g.z += list[i].z;
    }
    g.x /= n; g.y /= n; g.z /= n;
    var out = [], toW = P.SceneBridge.toWorld;
    for (i = 0; i < n; i++) {
      var q = list[i];
      out.push({ x: toW(q.x - g.x), y: toW(q.y - g.y), z: toW(q.z - g.z) });
      if (!isFinite(out[i].x) || !isFinite(out[i].y) || !isFinite(out[i].z)) return null;
    }
    return out;
  }
  // Fallback placement: the drawing itself, laid into the plane the camera looks
  // at, so a hexagon drawn by hand still reads as a hexagon in the scene.
  function planarLayout(f) {
    var cx = 0, cy = 0, n = f.syms.length, i;
    for (i = 0; i < n; i++) {
      var a = atomById(f.ids[i]);
      cx += a.x; cy += a.y;
    }
    cx /= n; cy /= n;
    var out = [];
    for (i = 0; i < n; i++) {
      var at = atomById(f.ids[i]);
      out.push({ u: (at.x - cx) * WORLD_PER_PX, v: -(at.y - cy) * WORLD_PER_PX });
    }
    return out;
  }
  function spreadOf(local) {
    var s = 0, i;
    for (i = 0; i < local.length; i++) {
      var d = local[i].x !== undefined ? Math.hypot(local[i].x, local[i].y, local[i].z)
        : Math.hypot(local[i].u, local[i].v);
      s = Math.max(s, d);
    }
    return s;
  }
  function findSceneBond(aId, bId) {
    var A = app(), found = null;
    if (!A || !A.bonds || !A.bonds.forEach) return null;
    A.bonds.forEach(function (b) {
      if (found !== null || !b) return;
      if ((b.a === aId && b.b === bId) || (b.a === bId && b.b === aId)) found = b.id;
    });
    return found;
  }
  function sceneBondOrder(bid) {
    var A = app();
    if (!A || !A.bonds || typeof A.bonds.get !== 'function') return 0;
    try { var b = A.bonds.get(bid); return b ? (b.order || 1) : 0; } catch (e) { return 0; }
  }
  function sceneCompKey(ids) {
    return ids.slice().sort(function (x, y) { return x - y; }).join(',');
  }

  function exportToScene() {
    var A = app();
    if (!A || typeof A.spawnAtom !== 'function' || typeof A.devBond !== 'function') {
      toast(tx('needGame'), 'err');
      return null;
    }
    if (!doc.atoms.length) { toast(tx('emptyDoc'), 'err'); return null; }
    if (doc.atoms.length > SCENE_MAX_ATOMS) {
      toast(tx('tooBig', { n: doc.atoms.length, max: SCENE_MAX_ATOMS }), 'err');
      return null;
    }
    if (A.atoms.size + doc.atoms.length > SCENE_MAX_ATOMS) {
      toast(tx('exportNoRoom', { n: doc.atoms.length }), 'err');
      return null;
    }
    var comps = components();
    if (comps.length > 1) toast(tx('notConnected', { n: comps.length }), 'info');

    // Handing the drawing to the scene puts real atoms on the table, so it is
    // bought the way every other build is: the whole structure is paid for up
    // front, at the sum of its atoms, and a short bill stops the export instead
    // of half-drawing it. Free-play mode (god mode) skips the bill, as it does
    // for a hand placement.
    var bill = [], c0, i0;
    for (c0 = 0; c0 < comps.length; c0++) {
      var syms0 = fragData(comps[c0]).syms;
      for (i0 = 0; i0 < syms0.length; i0++) bill.push(syms0[i0]);
    }
    var crate = crateBridge(A), cost = 0;
    if (crate && !crate.free()) {
      cost = crate.price(bill);
      if (!crate.bill(bill)) {
        toast(tx('exportNeedStars', { n: cost }), 'err');
        var shop = window.__mol3dShop;
        if (shop && typeof shop.flash === 'function') { try { shop.flash(); } catch (ef) {} }
        return null;
      }
    }

    // the game's own one-call builder, if a newer bundle ever exposes it
    if (typeof A.buildMoleculeAt === 'function') {
      var res = null;
      try {
        var one = fragData(comps[0]);
        var pos0 = enginePositions(one) || planarLayout(one);
        var anchor0 = findAnchor(spreadOf(pos0));
        res = A.buildMoleculeAt({
          atoms: one.syms, bonds: one.bonds, charge: one.q
        }, anchor0.x, anchor0.y, anchor0.z);
      } catch (e) { res = null; }
      if (res && res.ids && res.ids.length) {
        if (crate) { try { crate.take(res.ids); } catch (et) {} }
        try { A.reanalyze(new Set(res.ids)); } catch (e2) { /* older signature */ }
        if (A.invalidate) A.invalidate();
        toast(tx('exported', { list: tx('exportedList', { n: res.ids.length, b: 0 }) + costText(cost) }), 'ok');
        return { ids: res.ids, atoms: res.ids.length, bonds: 0, rejected: [], cost: cost };
      }
    }

    var made = [], bondCount = 0, rejected = [], lowered = [], noRoom = 0;
    for (var c = 0; c < comps.length; c++) {
      var f = fragData(comps[c]);
      if (!f.syms.length) continue;
      var pos = enginePositions(f);
      var local = pos || planarLayout(f);
      var anchor = findAnchor(spreadOf(local));
      var map = [], i;
      for (i = 0; i < f.syms.length; i++) {
        var at = pos
          ? { x: anchor.x + pos[i].x, y: anchor.y + pos[i].y, z: anchor.z + pos[i].z }
          : planePoint(anchor, viewBasis(), local[i].u, local[i].v);
        var id = null;
        try {
          // charged placement: crate.bill above put these atoms into the crate, and
          // an ordinary take is what lets deleting them return them.
          id = A.spawnAtom(f.syms[i], at, { silent: true });
        } catch (e) { id = null; }
        if (id === null || id === undefined) { noRoom++; continue; }
        map[i] = id;
        made.push(id);
      }
      for (i = 0; i < f.bonds.length; i++) {
        var ia = f.bonds[i][0], ib = f.bonds[i][1], order = f.bonds[i][2];
        if (map[ia] === undefined || map[ib] === undefined) continue;
        // No god-mode retry: the drawing may be anything, but the scene only
        // takes bonds its own rules accept, and a refused bond is reported as one.
        var ok = false;
        try { ok = A.devBond(map[ia], map[ib]) !== false; } catch (e) { ok = false; }
        var bid = findSceneBond(map[ia], map[ib]);
        if (bid === null) {
          rejected.push(f.syms[ia] + '–' + f.syms[ib]);
          continue;
        }
        // The scene raises a bond one legal step at a time, exactly the way the
        // player's own bond tool does. Writing the order straight in would let a
        // drawing place a multiple bond the scene's rules refuse.
        if (order > 1) {
          for (var u = 1; u < order; u++) {
            if (sceneBondOrder(bid) !== u) break;
            try { A.devUpgrade(bid); } catch (e3) { break; }
          }
          var reached = sceneBondOrder(bid);
          if (reached < order) lowered.push(f.syms[ia] + ordGlyph(reached) + f.syms[ib]);
        }
        bondCount++;
      }
      if (f.q && map.length) {
        try { A.overrides.set(sceneCompKey(map), f.q); } catch (e4) { /* overrides may be gone */ }
      }
    }
    if (!made.length) {
      toast(tx('exportBroken', { reason: tx('exportNoRoom', { n: noRoom }) }), 'err');
      return null;
    }
    try { A.reanalyze(new Set(made)); } catch (e5) { A.reanalyze(); }
    if (A.invalidate) A.invalidate();
    if (typeof A.refreshInspector === 'function') { try { A.refreshInspector(); } catch (e6) {} }
    var summary = tx('exportedList', { n: made.length, b: bondCount }) + costText(cost);
    if (rejected.length) summary += ' · ' + tx('exportRejected', { n: rejected.length, list: rejected.slice(0, 4).join(', ') });
    if (lowered.length) summary += ' · ' + tx('exportLowered', { n: lowered.length, list: lowered.slice(0, 4).join(', ') });
    if (noRoom) summary += ' · ' + tx('exportNoRoom', { n: noRoom });
    toast(tx('exported', { list: summary }), rejected.length || noRoom || lowered.length ? 'info' : 'ok');
    return { ids: made, atoms: made.length, bonds: bondCount, rejected: rejected, lowered: lowered, noRoom: noRoom, cost: cost };
  }

  // The crate, reached through the game's own hook when the bundle has one and
  // through the shop object when it does not. Without either there is nothing to
  // charge, so the export behaves the way it always did.
  function crateBridge(A) {
    if (A.crate && typeof A.crate.bill === 'function' && typeof A.crate.take === 'function') return A.crate;
    var s = window.__mol3dShop;
    if (!s || typeof s.buyAtoms !== 'function' || typeof s.takeAtom !== 'function' || typeof s.priceOfAtoms !== 'function') return null;
    return {
      free: function () { return !!(window.__mol3d && window.__mol3d._godMode === true); },
      price: function (list) { return s.priceOfAtoms(list); },
      bill: function (list) { var r = s.buyAtoms(list); return !!(r && r.ok); },
      take: function (ids) {
        var atoms2 = window.__mol3d && window.__mol3d.atoms;
        for (var i = 0; i < (ids || []).length; i++) {
          var at = atoms2 && typeof atoms2.get === 'function' ? atoms2.get(ids[i]) : null;
          if (at && at.el && at.el.z) s.takeAtom(at.el.z);
        }
      }
    };
  }
  function costText(n) { return n > 0 ? ' · ⭐ ' + n : ''; }

  // ==========================================================================
  // 15. Panel placement, chrome wiring, entry button.
  // ==========================================================================
  var ACT_RUN = {
    undo: function () { undo(); },
    redo: function () { redo(); },
    copy: function () { actCopy(); },
    cut: function () { actCut(); },
    paste: function () {
      if (ui.clip && ui.clip.atoms.length) actPaste(pasteOffset());
      else toast(tx('nothingPaste'), 'err');
    },
    all: function () { actSelectAll(); },
    del: function () { actDeleteSel(); },
    addH: function () { actAddHydrogens(); },
    clean: function () { actCleanLayout(); },
    fit: function () { actFit(); },
    to3d: function () { return exportToScene(); },
    png: function () { exportPNG(); },
    mol: function () { openIo('mol'); },
    smiles: function () { openIo('smiles'); }
  };

  // Mobile: the media query turns the panel into a full-width sheet and pins its
  // geometry with !important, so dragging/resizing is switched off there.
  function isSheet() {
    try {
      return !!(window.matchMedia && (window.matchMedia('(max-width:780px)').matches ||
        window.matchMedia('(max-height:640px)').matches));
    } catch (e) { return false; }
  }

  function clampIntoView() {
    if (!els.panel || isSheet()) return;
    var vw = Math.max(240, window.innerWidth), vh = Math.max(240, window.innerHeight);
    var w = els.panel.offsetWidth || 740, h = els.panel.offsetHeight || 520;
    var l = parseFloat(els.panel.style.left);
    var t = parseFloat(els.panel.style.top);
    if (!isFinite(l)) l = Math.round((vw - w) / 2);
    if (!isFinite(t)) t = Math.round((vh - h) / 2);
    els.panel.style.left = clampNum(l, 4, Math.max(4, vw - Math.min(w, vw - 8) - 4)) + 'px';
    els.panel.style.top = clampNum(t, 44, Math.max(44, vh - Math.min(h, vh - 48) - 4)) + 'px';
  }

  function ensurePlaced() {
    if (isSheet()) return;
    if (els.panel.dataset.placed) { clampIntoView(); return; }
    var vw = Math.max(240, window.innerWidth), vh = Math.max(240, window.innerHeight);
    var w = clampNum(Math.round(Math.min(1000, vw - 80)), 320, Math.max(320, vw - 16));
    var h = clampNum(Math.round(Math.min(640, vh - 150)), 250, Math.max(250, vh - 56));
    els.panel.style.width = w + 'px';
    els.panel.style.height = h + 'px';
    els.panel.style.left = clampNum(Math.round((vw - w) / 2), 4, Math.max(4, vw - w - 4)) + 'px';
    els.panel.style.top = clampNum(Math.round(Math.max(52, (vh - h) / 2)), 44,
      Math.max(44, vh - h - 4)) + 'px';
    els.panel.dataset.placed = '1';
    var r = els.canvasWrap.getBoundingClientRect();
    ui.pan.x = r.width / 2;
    ui.pan.y = r.height / 2;
    clampPan();
  }

  function toggleMin() {
    ui.min = !ui.min;
    els.panel.classList.toggle('min', ui.min);
    els.min.textContent = ui.min ? '+' : '–';
    els.min.title = ui.min ? tx('expand') : tx('minimize');
    els.min.setAttribute('aria-label', els.min.title);
    if (!ui.min) ensurePlaced();
    hideCtx();
    scheduleSave();
    window.setTimeout(function () { if (ui.open) refresh(); }, 0);
  }

  function startChromeDrag(e, kind) {
    if (isSheet() || e.button === 2) return;
    var r = els.panel.getBoundingClientRect();
    var pid = e.pointerId;
    var sx = e.clientX, sy = e.clientY;
    var l0 = r.left, t0 = r.top, w0 = r.width, h0 = r.height;
    var moved = false;
    function onMove(ev) {
      if (pid !== undefined && ev.pointerId !== undefined && ev.pointerId !== pid) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) moved = true;
      if (!moved) return;
      if (kind === 'move') {
        els.panel.style.left = clampNum(l0 + dx, 8 - w0, window.innerWidth - 60) + 'px';
        els.panel.style.top = clampNum(t0 + dy, 0, window.innerHeight - 34) + 'px';
      } else {
        els.panel.style.width = clampNum(w0 + dx, 320, Math.max(320, window.innerWidth - 8)) + 'px';
        els.panel.style.height = clampNum(h0 + dy, 250, Math.max(250, window.innerHeight - 8)) + 'px';
      }
      if (ev.cancelable) ev.preventDefault();
      render();
    }
    function onUp(ev) {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      if (!moved) return;
      els.panel.dataset.placed = '1';
      clampIntoView();
      scheduleSave();
      refresh();
    }
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
  }

  function onToggleClick(key) {
    if (key === 'grid') {
      setGrid(!ui.grid);
      toast(ui.grid ? tx('snapOn') : tx('snapOff'), 'info');
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(ui, key)) return;
    ui[key] = !ui[key];
    if (key === 'vsepr') toast(ui.vsepr ? tx('geometryOn') : tx('geometryOff'), 'info');
    scheduleSave();
    refresh();
  }

  function onZoomClick(z) {
    if (z === 'in') zoomStep(1.25);
    else if (z === 'out') zoomStep(0.8);
    else actFit();
  }

  // Enter in the element box: exact symbol, atomic number, or (uniquestly) a
  // prefix of a name in either language.
  function matchElement(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    var i, e;
    if (/^[0-9]+$/.test(s)) {
      for (i = 0; i < ELEMENTS.length; i++) if (ELEMENTS[i].z === +s) return ELEMENTS[i].sym;
      return null;
    }
    var low = s.toLowerCase();
    for (i = 0; i < ELEMENTS.length; i++) if (String(ELEMENTS[i].sym).toLowerCase() === low) return ELEMENTS[i].sym;
    for (i = 0; i < ELEMENTS.length; i++) {
      e = ELEMENTS[i];
      if (String(e.name || '').toLowerCase() === low) return e.sym;
      if (String(elNameLocal(e) || '').toLowerCase() === low) return e.sym;
    }
    var one = s.slice(0, 1).toUpperCase() + s.slice(1).toLowerCase();
    for (i = 0; i < ELEMENTS.length; i++) if (ELEMENTS[i].sym === one) return ELEMENTS[i].sym;
    var hits = [];
    for (i = 0; i < ELEMENTS.length; i++) {
      e = ELEMENTS[i];
      var cand = [String(e.name || '').toLowerCase(), String(elNameLocal(e) || '').toLowerCase(),
        String(e.sym).toLowerCase()];
      for (var k = 0; k < cand.length; k++) {
        if (cand[k].length > low.length && cand[k].indexOf(low) === 0) { hits.push(e.sym); break; }
      }
    }
    return hits.length === 1 ? hits[0] : null;
  }

  function wireChrome() {
    els.head.addEventListener('pointerdown', function (e) {
      if (e.target && e.target.closest && e.target.closest('.bp-hbtn')) return;
      startChromeDrag(e, 'move');
    });
    els.resize.addEventListener('pointerdown', function (e) { startChromeDrag(e, 'size'); });

    els.panel.addEventListener('click', function (e) {
      if (!ui.open) return;
      var t = e.target;
      if (!t || !t.closest) return;
      var b = t.closest('.bp-hbtn');
      if (b) {
        if (b === els.close) close();
        else if (b === els.help) toggleHelp();
        else if (b === els.min) toggleMin();
        return;
      }
      b = t.closest('.bp-tool');
      if (b) { setTool(b.dataset.tool); return; }
      b = t.closest('#bp-orders button');
      if (b) { setBondOrder(+b.dataset.o); return; }
      b = t.closest('.bp-tg');
      if (b) { onToggleClick(b.dataset.tg); return; }
      b = t.closest('#bp-elchip');
      if (b) { openElPop(); return; }
      b = t.closest('#bp-zoombtns button');
      if (b) { onZoomClick(b.dataset.z); return; }
      b = t.closest('#bp-io [data-io]');
      if (b) {
        if (b.dataset.io === 'copy') ioCopy();
        else if (b.dataset.io === 'save') ioSave();
        else hideIo();
        return;
      }
      b = t.closest('#bp-helpcard [data-help]');
      if (b) { toggleHelp(false); return; }
      b = t.closest('#bp-foot [data-act]');
      if (b && ACT_RUN[b.dataset.act]) { ACT_RUN[b.dataset.act](); return; }
    });

    els.elSearch.addEventListener('input', function () {
      if (!elPopOpen) openElPop(true);
      buildElList(els.elSearch.value);
    });
    els.elSearch.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      var raw = els.elSearch.value;
      var sym = matchElement(raw);
      if (sym && setElement(sym)) {
        openElPop(false);
        els.elSearch.value = '';
        toast(sym + ' · ' + elNameLocal(elOf(sym)), 'ok');
      } else if (String(raw).trim()) {
        toast(tx('unknownEl', { sym: String(raw).trim() }), 'err');
      }
    });

    els.canvas.addEventListener('pointerdown', function (e) { onPointerDown(e); });
    els.canvas.addEventListener('pointermove', function (e) { onPointerMove(e); });
    els.canvas.addEventListener('pointerup', function (e) { onPointerUp(e); });
    els.canvas.addEventListener('pointercancel', function (e) { onPointerUp(e); });
    els.canvas.addEventListener('pointerleave', function () {
      if (ui.hover && !ui.drag) { ui.hover = null; render(); }
    });
    els.canvas.addEventListener('wheel', function (e) { onWheel(e); }, { passive: false });
    els.canvas.addEventListener('contextmenu', function (e) {
      if (!ui.open || ui.min) return;
      e.preventDefault();
      openCtx(e.clientX, e.clientY);
    });
    els.ctx.addEventListener('click', function (e) { onCtxClick(e); });

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('pointerdown', onDocPointer, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('blur', onWindowBlur);
  }

  // Capture phase, so a press outside the popovers closes them before the click
  // that follows can land on the game UI underneath.
  function onDocPointer(e) {
    if (!ui.open) return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (els.ctx.contains(t)) return;
    hideCtx();
    if (elPopOpen && !els.elpop.contains(t) && t !== els.elSearch && !els.elchip.contains(t)) {
      openElPop(false);
    }
  }

  function onResize() {
    clampIntoView();
    if (!ui.open) return;
    hideCtx();
    if (elPopOpen) openElPop(false);
    refresh();
  }
  function onWindowBlur() {
    ui.space = false;
    ui.ptrs = {};
    ui.pinch = null;
    if (ui.open) syncCursor();
  }

  var fittedOnce = false;

  // A board restored from storage can carry bonds drawn before the rules were
  // wired in: the gate guards what is made from now on, not what is loaded. The
  // first open that finds the engine answering repairs the document once, the
  // same way a preset does.
  var savedRepaired = false;
  function repairRestoredDoc() {
    if (savedRepaired || !rules() || !doc.bonds.length) return;
    savedRepaired = true;
    var notes = repairBoard();
    if (!notes.length) return;
    saveAll();
    toast(repairedNote('saveRepairedOne', 'saveRepaired', notes.length) + ': ' + notes.join('; '), 'err');
  }

  function open() {
    if (ui.open) return;
    var A = app();
    if (A && typeof A.closeMobileSheets === 'function') {
      try { A.closeMobileSheets(); } catch (e) { /* only mobile has sheets to close */ }
    }
    ui.open = true;
    els.panel.classList.add('open');
    els.panel.removeAttribute('aria-hidden');
    ensurePlaced();
    rebuildElementsIfNeeded();
    repairRestoredDoc();
    refresh();
    if (!fittedOnce) { fittedOnce = true; actFit(); }
    // re-measure once the browser has laid the sheet out for real
    window.requestAnimationFrame(function () { if (ui.open) refresh(); });
  }

  function close() {
    if (!ui.open) return;
    hideCtx();
    if (elPopOpen) openElPop(false);
    if (els.io.classList.contains('open')) hideIo();
    if (ui.help) toggleHelp(false);
    ui.open = false;
    ui.sel = [];
    ui.drag = null;
    ui.box = null;
    ui.previewBond = null;
    ui.pendingBond = 0;
    ui.hover = null;
    ui.ptrs = {};
    ui.pinch = null;
    els.panel.classList.remove('open');
    els.panel.setAttribute('aria-hidden', 'true');
    saveAll();
  }

  function toggle() { if (ui.open) close(); else open(); }

  // Same two-step the Physics panel uses: the INFO tab host if the game has built
  // it, otherwise the top bar, so the entry exists even on a partial page.
  function makeEntryBtn() {
    var btn = document.createElement('button');
    btn.id = 'btn-blueprint';
    btn.className = 'science-entry';
    btn.innerHTML = ic('pencil-ruler') + esc(tx('menuBtn'));
    lucideIn(btn);
    btn.addEventListener('click', function () { toggle(); });
    return btn;
  }
  function addEntryButton() {
    if (document.getElementById('btn-blueprint')) return;
    var host = document.getElementById('science-entries');
    if (host) { host.appendChild(makeEntryBtn()); return; }
    var header = document.querySelector('.header-right');
    if (!header) return;
    var tb = makeEntryBtn();
    tb.classList.add('btn-small');
    var sel = document.getElementById('topic-selector');
    if (sel) header.insertBefore(tb, sel); else header.appendChild(tb);
  }

  function onLangChange(force) {
    var l = langNow();
    if (l === lastLang && !force) return;
    lastLang = l;
    var b = document.getElementById('btn-blueprint');
    if (b) {
      b.innerHTML = ic('pencil-ruler') + esc(tx('menuBtn'));
      b.title = tx('menuBtn');
      lucideIn(b);
    }
    rebuildElementsIfNeeded();
    if (elPopOpen) { els.elSearch.value = ''; buildElList(''); }
    if (els.io.classList.contains('open')) {
      els.ioTitle.textContent = tx(els.io.dataset.kind === 'mol' ? 'molHead' : 'smilesHead');
    }
    if (ui.open) refresh(); else syncButtons();
  }

  // ==========================================================================
  // 16. Public API and bootstrap. The panel builds itself on load, the entry
  //     button waits for the game bundle (assets run before it exists).
  // ==========================================================================
  var VERSION = '1.0.0';
  var mounted = false;

  function bondById(id) {
    for (var i = 0; i < doc.bonds.length; i++) if (doc.bonds[i].id === id) return doc.bonds[i];
    return null;
  }

  // Accepts getState() output, a preset-style {atoms,bonds} object, or a JSON
  // string. Positions come over as-is; everything else is validated.
  function normalizeState(s) {
    var atoms = (s && (s.a || s.atoms)) || [];
    if (!Array.isArray(atoms)) return null;
    var a = [], byOld = {}, byNew = {}, i;
    for (i = 0; i < atoms.length; i++) {
      var t = atoms[i] || {};
      var sym = String(t.sym || t.element || '').trim();
      if (!sym) continue;
      var want = sym.slice(0, 1).toUpperCase() + sym.slice(1).toLowerCase();
      var el = elOf(want) || elOf(sym);
      if (!el) continue;
      var id = newId();
      // An import that states lone pairs means them; one that does not leaves the
      // count to the electron bookkeeping.
      var lpv = t.lp === undefined || t.lp === null || t.lp === '' ? null
        : clampNum(Math.round(num(t.lp)), 0, 6);
      var rec = {
        id: id, sym: el.sym,
        x: Math.round(num(t.x)), y: Math.round(num(t.y)),
        q: clampNum(Math.round(num(t.q !== undefined ? t.q : t.charge)), -8, 8),
        lp: lpv === null ? 0 : lpv,
        lpSet: lpv === null ? 0 : 1
      };
      a.push(rec);
      byNew[id] = rec;
      if (t.id !== undefined && t.id !== null) byOld[String(t.id)] = id;
      byOld[String(i)] = byOld[String(i)] || id;   // preset arrays are index-keyed
    }
    if (!a.length) return null;
    var rawBonds = (s && (s.b || s.bonds)) || [];
    if (!Array.isArray(rawBonds)) rawBonds = [];
    var b = [];
    for (i = 0; i < rawBonds.length; i++) {
      var x = rawBonds[i];
      var oa = Array.isArray(x) ? x[0] : (x && (x.a !== undefined ? x.a : x.from));
      var ob = Array.isArray(x) ? x[1] : (x && (x.b !== undefined ? x.b : x.to));
      var ord = Array.isArray(x) ? (x[2] || 1) : (x && (x.order || x.o || 1));
      var ia = byOld[String(oa)], ib = byOld[String(ob)];
      if (ia === undefined || ib === undefined || ia === ib) continue;
      if (bondBetween(ia, ib)) continue;
      var A = byNew[ia], B = byNew[ib];
      // Only a cheap per-atom ceiling while the document is still being assembled;
      // the real audit runs on the assembled board in loadState.
      var ceil = Math.min(capacityOf(A.sym), capacityOf(B.sym), 5);
      b.push({
        id: newId(), a: ia, b: ib, ionic: !!(x && x.ionic),
        order: clampNum(Math.round(num(ord)) || 1, 1, ceil)
      });
    }
    var rawK = (s && (s.k || s.brackets)) || [];
    if (!Array.isArray(rawK)) rawK = [];
    var k = [];
    for (i = 0; i < rawK.length; i++) {
      var grp = rawK[i] || {}, ids = Array.isArray(grp.ids) ? grp.ids : [];
      var m = [];
      for (var j = 0; j < ids.length; j++) {
        var mm = byOld[String(ids[j])];
        if (mm !== undefined && m.indexOf(mm) < 0) m.push(mm);
      }
      if (m.length > 1) {
        m.sort(function (p, q) { return p - q; });
        k.push({ key: m.join(','), ids: m, q: Math.round(num(grp.q)) || 0 });
      }
    }
    return { a: a, b: b, k: k, n: doc.nextId };
  }

  function apiLoad(state) {
    ensureUp();
    var s = state;
    if (typeof s === 'string') { try { s = JSON.parse(s); } catch (e) { s = null; } }
    if (!s || typeof s !== 'object') { toast(tx('loadFailed'), 'err'); return false; }
    var norm = normalizeState(s);
    if (!norm) { toast(tx('loadFailed'), 'err'); return false; }
    if (!ui.open) open();
    beforeChange();
    if (!applySnapshot(JSON.stringify(norm))) { ui.hist.pop(); toast(tx('loadFailed'), 'err'); return false; }
    // A file is a description of a molecule, not a licence to draw it: anything the
    // rules refuse is corrected here and named in the message.
    var fixNotes = repairBoard();
    ui.sel = [];
    afterChange();
    actFit();
    toast(tx('stateLoaded', {
      a: counted(doc.atoms.length, 'oneAtom', 'manyAtoms'),
      b: counted(doc.bonds.length, 'oneBond', 'manyBonds')
    }) +
      (fixNotes.length ? ' — ' + repairedNote('presetRepairedOne', 'presetRepaired', fixNotes.length) + ': ' + fixNotes.join('; ') : ''),
      fixNotes.length ? 'err' : 'ok');
    return true;
  }

  function ensureUp() { if (!mounted) mount(); }

  var api = {
    version: VERSION,
    open: function () { ensureUp(); open(); return ui.open; },
    close: function () { ensureUp(); close(); return ui.open; },
    toggle: function () { ensureUp(); toggle(); return ui.open; },
    isOpen: function () { return !!ui.open; },
    tools: (function () {
      var out = [];
      for (var i = 0; i < TOOLS.length; i++) if (!TOOLS[i].div) out.push(TOOLS[i].id);
      return out;
    })(),
    elements: function () {
      ensureUp();
      var out = [];
      for (var i = 0; i < ELEMENTS.length; i++) out.push(ELEMENTS[i].sym);
      return out;
    },
    setTool: function (t) { ensureUp(); setTool(String(t)); return ui.tool; },
    setElement: function (s) { ensureUp(); return !!setElement(String(s)); },
    setBondOrder: function (n) {
      ensureUp();
      setBondOrder(clampNum(Math.round(num(n)) || 1, 1, 3));
      return ui.bond;
    },
    place: function (sym, x, y, free) {
      ensureUp();
      if (sym !== undefined && sym !== null && sym !== '' && !setElement(String(sym))) return null;
      if (!ui.open) open();
      var a = actPlaceAtom(num(x), num(y), !!free);
      return a ? a.id : null;
    },
    bond: function (a, b, order) {
      ensureUp();
      var A = atomById(+a), B = atomById(+b);
      if (!A || !B) return null;
      var want = order === undefined || order === null || order === ''
        ? ui.bond : clampNum(Math.round(num(order)) || 1, 1, 5);
      actBond(A.id, B.id, want);
      var e = bondBetween(A.id, B.id);
      return e ? { id: e.id, a: e.a, b: e.b, order: e.order, ionic: !!e.ionic } : null;
    },
    erase: function (id) {
      ensureUp();
      if (id === undefined || id === null) {
        if (!ui.sel.length) return false;
        actDeleteSel();
        return true;
      }
      var a = atomById(+id);
      if (a) { actEraseAt(a.id, null); return true; }
      var bd = bondById(+id);
      if (bd) { actEraseAt(null, bd); return true; }
      return false;
    },
    select: function (ids) {
      ensureUp();
      if (ids === undefined || ids === null) { actSelectAll(); return ui.sel.slice(); }
      var list = Array.isArray(ids) ? ids : [ids], out = [];
      for (var i = 0; i < list.length; i++) if (atomById(+list[i])) out.push(+list[i]);
      ui.sel = out;
      afterChangeNoHist();
      return ui.sel.slice();
    },
    clear: function () { ensureUp(); if (!doc.atoms.length) return true; actClearAll(); return !doc.atoms.length; },
    load: function (state) { return apiLoad(state); },
    loadPreset: function (id) {
      ensureUp();
      if (!ui.open) open();
      return applyPreset(String(id));
    },
    presets: function () {
      ensureUp();
      var out = [];
      for (var i = 0; i < PRESETS.length; i++) out.push({ id: PRESETS[i].id, name: tx(PRESETS[i].key) });
      return out;
    },
    getState: function () { ensureUp(); return JSON.parse(snapshot()); },
    formula: function () { ensureUp(); return formulaText(); },
    counts: function () {
      ensureUp();
      return { atoms: doc.atoms.length, bonds: doc.bonds.length, rings: ringCount(),
        fragments: components().length, charge: netCharge(doc.atoms.map(function (x) { return x.id; })) };
    },
    toScene: function () { ensureUp(); return exportToScene(); },
    toMol: function () { ensureUp(); return toMol(); },
    toSmiles: function () { ensureUp(); return toSmiles(); },
    toPngDataUrl: function (px) { ensureUp(); return toPngDataUrl(px); },
    png: function () { ensureUp(); exportPNG(); return true; },
    undo: function () { ensureUp(); undo(); return ui.hist.length; },
    redo: function () { ensureUp(); redo(); return ui.future.length; },
    addHydrogens: function () { ensureUp(); if (!ui.open) open(); actAddHydrogens(); return doc.atoms.length; },
    cleanLayout: function () { ensureUp(); actCleanLayout(); return true; },
    fit: function () { ensureUp(); actFit(); return { zoom: ui.zoom, pan: { x: ui.pan.x, y: ui.pan.y } }; },
    view: function () { return { zoom: ui.zoom, pan: { x: ui.pan.x, y: ui.pan.y }, grid: ui.grid, snap: ui.snap, vsepr: ui.vsepr }; },
    help: function (on) { ensureUp(); toggleHelp(on); return !!ui.help; }
  };

  function mount() {
    if (mounted) return;
    mounted = true;
    injectStyles();
    buildElements();
    buildPanel();
    wireChrome();
    els.panel.setAttribute('aria-hidden', 'true');
    lastLang = langNow();
    loadAll();
    syncButtons();
    addEntryButton();

    var tries = 0;
    var waitGame = window.setInterval(function () {
      tries++;
      addEntryButton();
      rebuildElementsIfNeeded();
      if (tries > 200 || (document.getElementById('btn-blueprint') && elementsFromRegistry)) {
        window.clearInterval(waitGame);
      }
    }, 400);

    window.addEventListener('mol3d:lang', function () { onLangChange(true); });
    window.setInterval(function () { onLangChange(false); }, 250);

    // The board is a canvas, so CSS variables alone cannot recolour it: drop the
    // cached palette and the view-model (which bakes legible ink) and repaint.
    window.addEventListener('mol3d:theme', function () {
      PAL = null;
      view = null;
      refresh();
      if (elPopOpen) buildElList(els.elSearch.value || '');
    });
  }

  window.__blueprint = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
