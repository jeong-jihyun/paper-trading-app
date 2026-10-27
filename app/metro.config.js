const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 화면 미리보기(데모) 전용: EXPO_PUBLIC_DEMO=1 로 실행하면 Firebase 대신 app/demo 의 가짜 구현을 쓴다.
// 평소(환경변수 없음)에는 아무 영향이 없다.
if (process.env.EXPO_PUBLIC_DEMO === '1') {
  const map = {
    'firebase/app': 'demo/mock-app.ts',
    'firebase/auth': 'demo/mock-auth.ts',
    'firebase/firestore': 'demo/mock-firestore.ts',
  };
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (map[moduleName]) return { type: 'sourceFile', filePath: path.resolve(__dirname, map[moduleName]) };
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
