# 랩핑 프로젝트 운영보드 MVP

Next.js, React, TypeScript, Tailwind CSS, Supabase Auth/Database 기반의 운영보드 MVP입니다.

## 실행

Node.js와 npm이 설치되어 있어야 합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 새 PC에서 Git Clone으로 실행

새 PC에서는 Node.js LTS와 Git을 설치한 뒤 아래 순서로 실행합니다.

```powershell
git clone https://github.com/arinawj/-wj-MOAD-Proj-platform.git moad-proj-platform
cd .\moad-proj-platform
npm.cmd install
npm.cmd run dev
```

PowerShell에서 `npm`이 실행 정책 오류를 내면 `npm` 대신 `npm.cmd`를 사용합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

PowerShell 프롬프트가 `C:\WINDOWS\system32>`처럼 보이면 먼저 프로젝트 폴더로 이동합니다.

```powershell
cd "C:\Users\HP\Documents\프로젝트 관리 프로그램"
.\start-dev.cmd
```

서버 실행과 브라우저 열기를 한 번에 하려면 아래 파일을 실행합니다.

```powershell
cd "C:\Users\HP\Documents\프로젝트 관리 프로그램"
.\open-app.cmd
```

어느 위치에서든 바로 실행하려면 절대경로를 사용합니다.

```powershell
& "C:\Users\HP\Documents\프로젝트 관리 프로그램\start-dev.cmd"
```

PowerShell에서 `npm.ps1` 실행 정책 오류가 나면 `npm` 대신 `npm.cmd`를 사용합니다.

```powershell
npm.cmd run dev
```

이 PC처럼 `npm`이 PATH에 없으면, 프로젝트에 받은 포터블 Node를 사용할 수 있습니다.

```powershell
.\.tools\node-v24.15.0-win-x64\npm.cmd install
.\.tools\node-v24.15.0-win-x64\npm.cmd run dev
```

또는 Windows에서 `start-dev.cmd`를 실행해도 됩니다.

## Supabase 연결

1. `.env.example`을 `.env.local`로 복사합니다.
2. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 입력합니다.
3. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다.
4. `user_roles`에 최초 마스터 이메일을 추가합니다.

```sql
insert into public.user_roles (email, role)
values ('your-email@example.com', 'master')
on conflict (email) do update set role = excluded.role;
```

환경변수가 없으면 데모 모드로 실행됩니다. 데모 이메일은 아래와 같습니다.

- `master@wrapboard.local`: 마스터
- `editor@wrapboard.local`: 편집자
- `viewer@wrapboard.local`: 뷰어
- 그 외 이메일: 접근 불가

비밀번호는 데모 모드에서 아무 값이나 입력해도 됩니다.
