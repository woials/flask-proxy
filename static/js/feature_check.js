// feature_check.js (ES5のみ、evalを一切使わない)
(function () {
  // 'noModule'プロパティの有無で、ES Modules対応(≒ES2015+のモダンエンジン)かどうかを判定
  // これはeval系を使わない、純粋なDOM APIチェックなのでCSPの影響を受けない
  var supportsModern = 'noModule' in document.createElement('script');
  var supportsFetch = typeof window.fetch === 'function';

  if (supportsModern && supportsFetch) {
    var s = document.createElement('script');
    s.src = '/static/js/watch_override.js';
    document.body.appendChild(s);
  }
})();