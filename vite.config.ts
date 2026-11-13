import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 화면 왼쪽 아래에 빌드 번호(커밋 앞 7자리)를 표시해 어떤 배포를 보고 있는지 확인
const commit = (process.env.CF_PAGES_COMMIT_SHA ?? 'local').slice(0, 7)

export default defineConfig({ plugins: [react()], define: { __BUILD_ID__: JSON.stringify(commit) } })
