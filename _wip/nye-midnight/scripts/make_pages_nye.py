# builds index.html (guest) and personalize-w6kd.html (buyer) of the new product
import sys
P=sys.argv[1]; FOLDER='product/new-years-eve-invitation-1-2026-11-27'; KEY='new-years-eve-1'; V='20261127n'
SITE='/home/claude/site/'
old=open(SITE+'new-years-eve/personalize-m1d9.html').read()
lab=open(SITE+'product/lab-party-1-2026-11-24/personalize-l4b7.html').read()
def rep(s,o,n,cnt=1):
    assert s.count(o)>=1,(o[:70]); return s.replace(o,n) if cnt==0 else s.replace(o,n,cnt)
s=old
s=rep(s,"</style>",".linkerr{margin:12px 0 0;font-size:17px;font-weight:700;color:#9B1C1C}\n.keep{margin:10px 0 0;font-size:16px;color:#5B5248}\n</style>\n<!-- NEW STANDARD (product link, Nov 2026): three shared files + one line that names the product.\n     mode 'direct' in /shared/config.js -> this page is the maker, as before.\n     mode 'hash'   -> opened at this address it asks for the Etsy order number; the maker itself opens under /<hash>. -->\n<link rel=\"stylesheet\" href=\"/shared/product-link.css?v=20261124\">\n<script src=\"/shared/config.js?v=%s\"></script>\n<script src=\"/shared/keys.js?v=20261126\"></script>\n<script src=\"/shared/product-link.js?v=20261124\"></script>\n<script>ProductLink.entry({ product: '%s' });</script>"%(V,KEY))
s=rep(s,"        <p class=\"help\">Want to change something? Edit it above and tap &ldquo;Send my invitation&rdquo; again &mdash; you get a new link.</p>\n","        <p class=\"help\">Want to change something? Edit it above and tap &ldquo;Send my invitation&rdquo; again &mdash; you get a new link.</p>\n        <p class=\"keep\">Send this link to your guests &mdash; not the address of the page you are on. That one is your personal page.</p>\n")
s=rep(s,"      <div class=\"or\" aria-hidden=\"true\">or</div>\n      <button id=\"mkvid\"","      <p id=\"linkerr\" class=\"linkerr\" role=\"alert\" hidden></p>\n      <div class=\"or\" aria-hidden=\"true\">or</div>\n      <button id=\"mkvid\"")
s=rep(s,'<script src="invite.js"></script>\n<script src="../video/videomaker.js?v=20261124"></script>','<script src="invite.js?v=%s"></script>\n<script src="/video/videomaker.js?v=%s"></script>'%(V,V))
s=rep(s,"(function () {\n  var C = window.InviteCodec, KEY = 'inviteDraft-new-years-eve';","ProductLink.ready(function (session) {\n  var C = window.InviteCodec, KEY = 'inviteDraft-%s';"%KEY)
# sending: signed link through the service (hash) or at once (direct) - the block of the LAB copy
a=lab.index("  var sending = false;"); b=lab.index("  function openShare(link)")
oa=s.index("  $('send').addEventListener('click', function () {\n    if (!check()) return;\n    var link = inviteUrl();"); ob=s.index("  function openShare(link)")
s=s[:oa]+lab[a:b]+s[ob:]
a=s.index("  function inviteUrl() {"); b=s.index("  var tmr;"); s=s[:a]+s[b:]
s=rep(s,"var VT = 'new-years-eve', VFILE","var VT = '%s', VFILE"%KEY)
s=rep(s,"root: '../video/', face:","root: '/video/', face:")
assert s.rstrip().endswith("})();\n</script>\n</body>\n</html>") or True
i=s.rindex("})();"); s=s[:i]+"});"+s[i+5:]
s=rep(s,"index.html#","index.html#",0)
open(P+'/personalize-t8nz.html','w').write(s)
idx='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>You're invited!</title>
<meta name="description" content="You're invited to a New Year's Eve party. Tap to open your invitation.">
<meta property="og:title" content="You're invited! 🥂">
<meta property="og:description" content="Tap to open your invitation ✨">
<meta property="og:type" content="website">
<meta property="og:url" content="https://wishberrystudiogifts.github.io/%(F)s/">
<meta property="og:image" content="https://wishberrystudiogifts.github.io/%(F)s/assets/preview.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#09080a">
<link rel="stylesheet" href="invite.css?v=%(V)s">
<!-- NEW STANDARD: three shared files + one line that names the product (key from /shared/config.js) -->
<link rel="stylesheet" href="/shared/product-link.css?v=20261124">
<script src="/shared/config.js?v=%(V)s"></script>
<script src="/shared/keys.js?v=20261126"></script>
<script src="/shared/product-link.js?v=20261124"></script>
<script>ProductLink.recipientPage({ product: '%(K)s' });</script>
</head>
<body>
<img class="backdrop" src="assets/bg-blur-land.jpg" alt="">
<div id="stage"></div>
<div id="ivwrap"></div>
<div id="controls"></div>
<script>
window.CARD_CONFIG = {
  occasion: '%(K)s',
  shopUrl: 'https://wishberrystudiogifts.etsy.com'
};
</script>
<script src="invite.js?v=%(V)s"></script>
</body>
</html>
'''%dict(F=FOLDER,K=KEY,V=V)
open(P+'/index.html','w').write(idx)
print('pages written', len(s))
