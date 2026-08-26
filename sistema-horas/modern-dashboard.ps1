$ErrorActionPreference = "Stop"
$path = ".\src\main.tsx"
$content = Get-Content $path -Raw

function FindMatchingDivEnd {
    param([string]$Text,[int]$Start)
    $depth = 0
    $i = $Start
    while($i -lt $Text.Length){
        $open = [regex]::Match($Text.Substring($i), "<div\b")
        $close = [regex]::Match($Text.Substring($i), "</div>")
        if(-not $open.Success -and -not $close.Success){ throw "Fechamento do bloco não encontrado." }
        $op = if($open.Success){$i + $open.Index}else{[int]::MaxValue}
        $cl = if($close.Success){$i + $close.Index}else{[int]::MaxValue}
        if($op -lt $cl){
            $depth++
            $i = $op + $open.Length
        } else {
            $depth--
            $i = $cl + $close.Length
            if($depth -eq 0){ return $i }
        }
    }
    throw "Fim do bloco não encontrado."
}

# ---------- PIZZA ----------
$start = $content.IndexOf('<div className="hf-status-chart"')
if($start -lt 0){ throw "Bloco hf-status-chart não encontrado." }
$end = FindMatchingDivEnd $content $start
$pizza = @'
              <div className="hf-status-chart hf-status-chart-modern">
                <div className="hf-pie-modern">
                  <div
                    className="hf-pie-modern-chart"
                    style={{
                      background: (() => {
                        const total = dashboard.totalDemands || 0;
                        if (!total) return "#edf1f7";

                        const colors:Record<string,string> = {
                          "Aguardando análise":"#94a3b8",
                          "Em análise":"#3b82f6",
                          "Analisada":"#8b5cf6",
                          "Em desenvolvimento":"#06b6d4",
                          "Em homologação":"#f59e0b",
                          "Concluída":"#22c55e"
                        };

                        let current = 0;
                        const parts = statuses.map((s) => {
                          const count = dashboard.byStatus[s] || 0;
                          const percent = (count / total) * 100;
                          const start = current;
                          const end = current + percent;
                          current = end;
                          return `${colors[s] || "#64748b"} ${start}% ${end}%`;
                        });

                        return `conic-gradient(${parts.join(", ")})`;
                      })()
                    }}
                  >
                    <div className="hf-pie-modern-hole">
                      <strong>{dashboard.totalDemands}</strong>
                      <span>demandas</span>
                    </div>
                  </div>
                </div>

                <div className="hf-pie-modern-legend">
                  {statuses.map((s) => {
                    const count = dashboard.byStatus[s] || 0;
                    const total = dashboard.totalDemands || 0;
                    const percentage = total ? (count / total) * 100 : 0;

                    const colors:Record<string,string> = {
                      "Aguardando análise":"#94a3b8",
                      "Em análise":"#3b82f6",
                      "Analisada":"#8b5cf6",
                      "Em desenvolvimento":"#06b6d4",
                      "Em homologação":"#f59e0b",
                      "Concluída":"#22c55e"
                    };

                    return (
                      <div className="hf-pie-modern-row" key={s}>
                        <div className="hf-pie-modern-name">
                          <span className="hf-pie-modern-dot" style={{background:colors[s] || "#64748b"}} />
                          <span>{s}</span>
                        </div>
                        <strong>{count}</strong>
                        <small>{percentage.toFixed(0)}%</small>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hf-panel hf-hours-chart-panel hf-hours-modern">
                <div className="hf-modern-panel-title">
                  <div>
                    <span className="hf-modern-eyebrow">HORAS</span>
                    <h3>Horas por tipo</h3>
                  </div>
                  <div className="hf-modern-total">{dashboard.totalHours}h</div>
                </div>

                <div className="hf-hours-bar-chart">
                  <div className="hf-hours-bar-item">
                    <div className="hf-hours-bar-top"><span>Análise</span><strong>{dashboard.analysisHours}h</strong></div>
                    <div className="hf-hours-bar-track-modern">
                      <div className="hf-hours-bar-fill-modern hf-hours-bar-analysis" style={{width:`${dashboard.totalHours ? Math.min(100,(dashboard.analysisHours / dashboard.totalHours) * 100) : 0}%`}} />
                    </div>
                  </div>

                  <div className="hf-hours-bar-item">
                    <div className="hf-hours-bar-top"><span>Necessárias</span><strong>{dashboard.requiredHours}h</strong></div>
                    <div className="hf-hours-bar-track-modern">
                      <div className="hf-hours-bar-fill-modern hf-hours-bar-required" style={{width:`${dashboard.totalHours ? Math.min(100,(dashboard.requiredHours / dashboard.totalHours) * 100) : 0}%`}} />
                    </div>
                  </div>

                  <div className="hf-hours-bar-item">
                    <div className="hf-hours-bar-top"><span>Finalizadas</span><strong>{dashboard.finishedHours || 0}h</strong></div>
                    <div className="hf-hours-bar-track-modern">
                      <div className="hf-hours-bar-fill-modern hf-hours-bar-finished" style={{width:`${dashboard.totalHours ? Math.min(100,((dashboard.finishedHours || 0) / dashboard.totalHours) * 100) : 0}%`}} />
                    </div>
                  </div>
                </div>

                <div className="hf-hours-modern-footer">
                  <span>Total planejado</span>
                  <strong>{dashboard.totalHours}h</strong>
                </div>
              </div>
            </div>
            <div className="hf-dashboard-demand-panel">
              <div className="hf-panel-title">
                <span>ACOMPANHAMENTO</span>
              </div>
              <div>

@' -replace '`r?`n','`n'
$content = $content.Substring(0,$start) + $pizza + $content.Substring($end)

# ---------- CSS ----------
$css = @'

/* DASHBOARD MODERNA */
.hf-status-chart-modern{display:grid!important;grid-template-columns:230px minmax(0,1fr)!important;align-items:center!important;gap:28px!important;width:100%!important;min-height:260px!important;}
.hf-pie-modern{display:flex!important;align-items:center!important;justify-content:center!important;}
.hf-pie-modern-chart{width:210px!important;height:210px!important;border-radius:50%!important;position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;box-shadow:0 8px 24px rgba(15,23,42,.08)!important;}
.hf-pie-modern-hole{width:116px!important;height:116px!important;border-radius:50%!important;background:#fff!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;box-shadow:0 2px 8px rgba(15,23,42,.06)!important;}
.hf-pie-modern-hole strong{font-size:31px!important;font-weight:800!important;line-height:1!important;color:#18243b!important;}
.hf-pie-modern-hole span{margin-top:6px!important;font-size:12px!important;color:#8b97a8!important;}
.hf-pie-modern-legend{display:flex!important;flex-direction:column!important;width:100%!important;}
.hf-pie-modern-row{display:grid!important;grid-template-columns:minmax(0,1fr) 50px 45px!important;align-items:center!important;min-height:42px!important;padding:6px 8px!important;border-bottom:1px solid #edf1f6!important;border-radius:8px!important;transition:.18s ease!important;}
.hf-pie-modern-row:last-child{border-bottom:0!important;}
.hf-pie-modern-row:hover{background:#f7f9fc!important;transform:translateX(3px)!important;}
.hf-pie-modern-name{display:flex!important;align-items:center!important;gap:10px!important;font-size:14px!important;color:#334155!important;}
.hf-pie-modern-dot{width:10px!important;height:10px!important;min-width:10px!important;border-radius:50%!important;}
.hf-pie-modern-row strong{text-align:right!important;font-size:14px!important;color:#18243b!important;}
.hf-pie-modern-row small{text-align:right!important;font-size:12px!important;color:#8b97a8!important;}
.hf-hours-modern{min-height:260px!important;}
.hf-modern-panel-title{display:flex!important;align-items:center!important;justify-content:space-between!important;}
.hf-modern-panel-title h3{margin:4px 0 0!important;font-size:17px!important;color:#18243b!important;}
.hf-modern-eyebrow{font-size:10px!important;font-weight:700!important;letter-spacing:.08em!important;color:#8b97a8!important;}
.hf-modern-total{font-size:28px!important;font-weight:800!important;color:#18243b!important;}
.hf-hours-bar-chart{display:flex!important;flex-direction:column!important;gap:22px!important;margin-top:28px!important;}
.hf-hours-bar-item{width:100%!important;}
.hf-hours-bar-top{display:flex!important;justify-content:space-between!important;align-items:center!important;margin-bottom:8px!important;}
.hf-hours-bar-top span{font-size:13px!important;color:#526176!important;}
.hf-hours-bar-top strong{font-size:14px!important;color:#18243b!important;}
.hf-hours-bar-track-modern{width:100%!important;height:10px!important;border-radius:999px!important;background:#edf1f7!important;overflow:hidden!important;}
.hf-hours-bar-fill-modern{height:100%!important;border-radius:999px!important;transition:width .45s ease!important;}
.hf-hours-bar-analysis{background:#3b82f6!important;}
.hf-hours-bar-required{background:#8b5cf6!important;}
.hf-hours-bar-finished{background:#22c55e!important;}
.hf-hours-modern-footer{display:flex!important;justify-content:space-between!important;margin-top:24px!important;padding-top:15px!important;border-top:1px solid #edf1f6!important;font-size:12px!important;color:#8b97a8!important;}
.hf-hours-modern-footer strong{font-size:14px!important;color:#18243b!important;}
@media(max-width:900px){.hf-status-chart-modern{grid-template-columns:190px minmax(0,1fr)!important}.hf-pie-modern-chart{width:180px!important;height:180px!important}.hf-pie-modern-hole{width:100px!important;height:100px!important}}
@media(max-width:700px){.hf-status-chart-modern{grid-template-columns:1fr!important;gap:20px!important}.hf-pie-modern-chart{width:175px!important;height:175px!important}.hf-pie-modern-hole{width:98px!important;height:98px!important}}

@' -replace '`r?`n','`n'

$last = $content.LastIndexOf('`')
if($last -lt 0){ throw "Final do CSS não encontrado." }
$content = $content.Insert($last,$css)
Set-Content $path $content -Encoding UTF8
Write-Host "DASHBOARD MODERNIZADA COM SUCESSO!" -ForegroundColor Green
