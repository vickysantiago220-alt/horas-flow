export const drawStatusReportGantt = (
  doc: any,
  demands: any[],
  period: string
) => {
  const statusConfig: Record<string, { color: number[] }> = {
    'Aguardando análise': { color: [148, 163, 184] },
    'Em análise': { color: [59, 130, 246] },
    'Analisada': { color: [139, 92, 246] },
    'Em desenvolvimento': { color: [6, 182, 212] },
    'Em homologação': { color: [245, 158, 11] },
    'Concluída': { color: [34, 197, 94] }
  };

  const normalizeStatus = (value: unknown) => {
    const text = String(value || '').toLowerCase();

    if (text.includes('aguardando análise') || text.includes('aguardando analise')) {
      return 'Aguardando análise';
    }
    if (text.includes('em análise') || text.includes('em analise')) {
      return 'Em análise';
    }
    if (text.includes('analisada')) {
      return 'Analisada';
    }
    if (text.includes('em desenvolvimento')) {
      return 'Em desenvolvimento';
    }
    if (text.includes('em homologação') || text.includes('em homologacao')) {
      return 'Em homologação';
    }
    if (text.includes('concluída') || text.includes('concluida')) {
      return 'Concluída';
    }

    return 'Aguardando análise';
  };

  const parseDate = (value: unknown): Date | null => {
    if (!value) return null;

    const text = String(value);

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [year, month, day] = text.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }

    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  let year: number;
  let month: number;

  if (period !== 'Todos' && /^\d{4}-\d{2}$/.test(period)) {
    const parts = period.split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1;
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginLeft = 8;
  const marginRight = 8;

  const demandWidth = 58;
  const approvedWidth = 28;
  const statusWidth = 32;

  const timelineWidth =
    pageWidth -
    marginLeft -
    marginRight -
    demandWidth -
    approvedWidth -
    statusWidth;

  const dayWidth = timelineWidth / daysInMonth;

  const startX = marginLeft;
  const headerY = 31;
  const headerHeight = 9;
  const rowHeight = 10;

  const truncate = (value: unknown, max: number) => {
    const text = String(value || '-').replace(/\s+/g, ' ').trim();

    if (text.length <= max) return text;

    return text.slice(0, Math.max(1, max - 1)) + '…';
  };

  const getDate = (demand: any) =>
    parseDate(
      demand.deliveryDate ??
      demand.delivery_date ??
      demand.requestDate ??
      demand.request_date ??
      demand.criadoEm ??
      demand.createdAt
    );

  const getStartDay = (demand: any) => {
    const date = parseDate(
      demand.requestDate ??
      demand.request_date ??
      demand.criadoEm ??
      demand.createdAt
    );

    if (!date) return 1;

    const day = date.getUTCFullYear() === year &&
      date.getUTCMonth() === month
      ? date.getUTCDate()
      : date < new Date(Date.UTC(year, month, 1))
        ? 1
        : daysInMonth;

    return Math.max(1, Math.min(daysInMonth, day));
  };

  const getEndDay = (demand: any) => {
    const date = getDate(demand);

    if (!date) return Math.min(daysInMonth, getStartDay(demand) + 1);

    const monthStart = new Date(Date.UTC(year, month, 1));
    const monthEnd = new Date(Date.UTC(year, month, daysInMonth));

    if (date < monthStart) return 1;
    if (date > monthEnd) return daysInMonth;

    return Math.max(
      1,
      Math.min(daysInMonth, date.getUTCDate())
    );
  };

  const getProgress = (demand: any) => {
    const explicit = Number(
      demand.progress ??
      demand.progresso ??
      demand.percentual ??
      demand.percentage ??
      0
    );

    if (Number.isFinite(explicit) && explicit > 0) {
      return Math.max(0, Math.min(100, explicit));
    }

    const status = normalizeStatus(demand.status);

    if (status === 'Aguardando análise') return 30;
    if (status === 'Em análise') return 60;
    if (status === 'Analisada') return 70;
    if (status === 'Em desenvolvimento') return 40;
    if (status === 'Em homologação') return 80;
    if (status === 'Concluída') return 100;

    return 0;
  };

  const drawPageHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 27, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GANTT DO PERÍODO', 8, 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      period === 'Todos' ? 'Todos os períodos' : period,
      8,
      19
    );
  };

  const drawTableHeader = () => {
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);

    doc.rect(
      startX,
      headerY,
      demandWidth,
      headerHeight,
      'FD'
    );

    doc.rect(
      startX + demandWidth,
      headerY,
      approvedWidth,
      headerHeight,
      'FD'
    );

    doc.rect(
      startX + demandWidth + approvedWidth,
      headerY,
      statusWidth,
      headerHeight,
      'FD'
    );

    doc.setTextColor(45, 55, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);

    doc.text(
      'DEMANDA',
      startX + 3,
      headerY + 6.5
    );

    doc.text(
      'APROVADO POR',
      startX + demandWidth + 3,
      headerY + 6.5
    );

    doc.text(
      'STATUS',
      startX + demandWidth + approvedWidth + 3,
      headerY + 6.5
    );

    for (let day = 1; day <= daysInMonth; day++) {
      const x =
        startX +
        demandWidth +
        approvedWidth +
        statusWidth +
        (day - 1) * dayWidth;

      doc.rect(
        x,
        headerY,
        dayWidth,
        headerHeight,
        'FD'
      );

      doc.setFontSize(5.5);

      doc.text(
        String(day).padStart(2, '0'),
        x + dayWidth / 2,
        headerY + 6.5,
        { align: 'center' }
      );
    }
  };

  const sortedDemands = [...demands].sort((a, b) => {
    const dateA = getDate(a)?.getTime() || 0;
    const dateB = getDate(b)?.getTime() || 0;

    return dateA - dateB;
  });

  let y = headerY + headerHeight;

  drawPageHeader();
  drawTableHeader();

  if (!sortedDemands.length) {
    doc.setTextColor(108, 122, 142);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    doc.text(
      'Nenhuma demanda encontrada para este período.',
      startX,
      y + 10
    );

    return;
  }

  sortedDemands.forEach((demand, index) => {
    if (y + rowHeight > 193) {
      doc.addPage();

      y = headerY + headerHeight;

      drawPageHeader();
      drawTableHeader();
    }

    const status = normalizeStatus(demand.status);
    const config = statusConfig[status] || statusConfig['Aguardando análise'];

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);

    doc.setFillColor(
      index % 2 === 0 ? 255 : 248,
      index % 2 === 0 ? 255 : 250,
      index % 2 === 0 ? 255 : 252
    );

    doc.rect(
      startX,
      y,
      demandWidth,
      rowHeight,
      'FD'
    );

    doc.rect(
      startX + demandWidth,
      y,
      approvedWidth,
      rowHeight,
      'FD'
    );

    doc.rect(
      startX + demandWidth + approvedWidth,
      y,
      statusWidth,
      rowHeight,
      'FD'
    );

    doc.setTextColor(22, 35, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);

    const number =
      String(demand.numero ?? demand.number ?? '-')
        .padStart(3, '0');

    doc.text(
      '#' + number,
      startX + 3,
      y + 4.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);

    doc.text(
      truncate(demand.problema ?? demand.problem, 34),
      startX + 3,
      y + 9
    );

    doc.setTextColor(45, 55, 72);
    doc.setFontSize(5.5);

    doc.text(
      truncate(
        demand.aprovadoPor ??
        demand.approvedBy ??
        '-',
        20
      ),
      startX + demandWidth + 3,
      y + 7
    );

    doc.setTextColor(
      config.color[0],
      config.color[1],
      config.color[2]
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);

    doc.text(
      truncate(status, 20),
      startX + demandWidth + approvedWidth + 3,
      y + 7
    );

    for (let day = 1; day <= daysInMonth; day++) {
      const x =
        startX +
        demandWidth +
        approvedWidth +
        statusWidth +
        (day - 1) * dayWidth;

      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(255, 255, 255);

      doc.rect(
        x,
        y,
        dayWidth,
        rowHeight,
        'FD'
      );
    }

    const startDay = getStartDay(demand);
    const endDay = Math.max(startDay, getEndDay(demand));

    const barX =
      startX +
      demandWidth +
      approvedWidth +
      statusWidth +
      (startDay - 1) * dayWidth +
      0.7;

    const barWidth =
      Math.max(
        dayWidth - 1.4,
        (endDay - startDay + 1) * dayWidth - 1.4
      );

    const barY = y + 3;

    doc.setFillColor(
      Math.min(255, config.color[0] + 205),
      Math.min(255, config.color[1] + 205),
      Math.min(255, config.color[2] + 205)
    );

    doc.roundedRect(
      barX,
      barY,
      barWidth,
      6,
      1.5,
      1.5,
      'F'
    );

    const progress = getProgress(demand);

    if (progress > 0) {
      doc.setFillColor(
        config.color[0],
        config.color[1],
        config.color[2]
      );

      doc.roundedRect(
        barX,
        barY,
        Math.max(0.8, barWidth * (progress / 100)),
        6,
        1.5,
        1.5,
        'F'
      );
    }

    y += rowHeight;
  });
};


