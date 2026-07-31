/* Supabase 접속 정보.

   이 키를 저장소에 그대로 두는 것은 의도된 것이다. publishable 키는 브라우저에
   내려보내라고 만든 공개 키이며, 이 키만으로 할 수 있는 일은 아래 셋뿐이다.

     cart_create()                  새 장바구니와 비밀 토큰 발급
     cart_load(id, token)           토큰이 맞을 때만 내용 반환
     cart_save(id, token, items)    토큰이 맞을 때만 저장

   carts 테이블 자체는 RLS로 잠겨 있어 이 키로 직접 조회하면 401이 난다.
   즉 남의 장바구니를 목록으로 훑거나 열어볼 방법이 없다.
   서버 비밀키(service_role)는 이 파일에 절대 넣지 않는다. */

window.LABUBU_SUPABASE = {
  url: 'https://wejmxmueydmvvfjklaex.supabase.co',
  key: 'sb_publishable_SHRJr8Mtpzr2Aj4naIZjxA_ZfW4UcAT'
};
