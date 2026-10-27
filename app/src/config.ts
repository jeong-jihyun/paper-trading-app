// 모의투자 기본 설정값. 실제 증권사 수수료·세율과 다를 수 있는 "가정값"이므로 필요하면 여기서 바꾼다.
export const INITIAL_CASH = 100_000_000; // 가입 시 지급하는 가상 자금(원)
export const FEE_RATE = 0.00015; // 매수·매도 수수료율 (0.015%)
export const SELL_TAX_RATE = 0.0018; // 매도 시 거래세율 (0.18%)

export const DATA_SOURCE_NOTICE =
  '시세 출처: 공공데이터포털(금융위원회_주식시세정보) · 하루 1회 갱신, 전일 종가 기준';
export const MOCK_NOTICE = '모의투자이며 실제 거래가 아닙니다.';
