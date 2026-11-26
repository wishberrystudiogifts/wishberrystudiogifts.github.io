/* Public key(s) that check the signature on invitation links (products in mode 'hash').
   The service makes its key pair itself on first use; the PUBLIC half is copied here once, right after the
   service first runs in production:  node service/tools/embed-pubkey.mjs   (service/README.md, "Release").
   A key that has ever been used is NEVER removed from this list — invitations signed with it must keep opening.
   While the list is empty, the recipient page asks the service for the key (works, but then guests depend on the service). */
window.WB_KEYS = [
  'BMu4bESSZGgXgNlRhTYwmU3hWjXkrJzkmq3nQuSG3t3VnFZ7jGxm7peqF23CfShRFZyuQstPV6eTpLjzNf3B_9w'
];
