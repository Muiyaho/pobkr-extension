# PoB KR 확장 프로그램

[PoB KR](https://pob.co.kr)의 웹 PoB를 위한 크롬·엣지 확장 프로그램 코드입니다.
설치 안내와 개인정보처리방침은 **https://pob.co.kr/extension** 에 있습니다.

이 저장소의 파일은 [Releases](https://github.com/Muiyaho/pobkr-extension/releases)의 zip에 든 파일 그대로입니다 (빌드나 압축 변환 없이 이 파일들을 묶은 것).
받은 zip이 같은 파일인지는 Releases에 적힌 SHA-256으로 확인할 수 있습니다.

## 하는 일

- **웹 PoB 캐릭터 가져오기**: 이 브라우저에 로그인된 Path of Exile 계정(카카오 `poe.kakaogames.com`, 공식 `pathofexile.com`)으로 캐릭터를 가져옵니다. 카카오 계정과 비공개 프로필도 됩니다.
- **웹 PoB 거래소 검색**: 웹 PoB 거래소 검색 창의 검색·매물 받기를 이 브라우저의 카카오 로그인으로 보냅니다.
- **카카오 거래소 ★ 저장한 검색**: 거래소 검색을 이름을 붙여 PoB KR 계정에 저장하고 다시 엽니다.
- **카카오 거래소 PoB 비교**: 매물마다 내 대표 빌드(또는 열려 있는 웹 PoB 빌드)에 장착했을 때 바뀌는 수치를 보여 주고, 웹 PoB에 바로 장착합니다.

확장이 없어도 웹 PoB는 그대로 쓸 수 있습니다.

## 파일

| 파일 | 내용 |
|---|---|
| `manifest.json` | 권한과 동작하는 페이지 |
| `background.js` | Path of Exile 사이트·카카오 거래소·PoB KR 서버에 보내는 요청 |
| `requests.js` | 허용하는 요청 목록 (그 밖의 요청은 거절) |
| `content.js` | 웹 PoB 페이지(`pob.co.kr/pob`)와 확장 사이의 연결 |
| `trade.js` | 카카오 거래소 페이지의 ★ 저장한 검색 패널과 PoB 비교 버튼 |
| `icons/` | 아이콘 |

## 동작 범위

- 웹 PoB 페이지(`pob.co.kr/pob`)와 카카오 거래소 페이지(`poe.kakaogames.com/trade`)에서만 동작합니다.
- 버튼을 누를 때만 요청을 보냅니다. 쿠키를 읽거나 저장하지 않고, 브라우저에 아무것도 저장하지 않습니다.
- Path of Exile 사이트에는 로그인된 계정 이름, 캐릭터 목록·장비·패시브 트리, 거래소 검색과 매물만 요청합니다. 귓속말·구매·계정 설정 변경 같은 요청은 보내지 않습니다.
- 거래소 요청은 이 브라우저에서 1분에 40번까지만 보냅니다.

자세한 내용은 [개인정보처리방침](https://pob.co.kr/extension#privacy)을 보세요.

## 문의

[PoB KR 피드백 게시판](https://pob.co.kr/feedback)에 남겨 주세요.
