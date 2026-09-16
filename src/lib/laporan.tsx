import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

/* ============================================================
 * Dokumen PDF laporan (server-side, @react-pdf/renderer).
 * Dibuat polos (light) karena dicetak/diunduh sebagai file.
 * ============================================================ */

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  brand: {
    fontSize: 7,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: "#9ca3af",
  },
  title: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "bold",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 9,
    color: "#4b5563",
  },
  dicetak: {
    marginTop: 10,
    fontSize: 8,
    color: "#6b7280",
  },
  hr: {
    marginTop: 8,
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: "#374151",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metaLabel: { fontSize: 9, color: "#6b7280" },
  metaValue: { fontSize: 9, fontWeight: "bold" },
  headRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 5,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 5,
  },
  cell: { paddingHorizontal: 4, fontSize: 8.5 },
  cellHeader: { paddingHorizontal: 4, fontSize: 8, fontWeight: "bold" },
  right: { textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#9ca3af",
  },
  kosong: { marginTop: 24, textAlign: "center", color: "#6b7280", fontSize: 10 },
  subheading: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "bold",
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#9ca3af",
    paddingVertical: 5,
  },
  bold: { fontWeight: "bold" },
});

export type LaporanPembayaranRow = {
  tanggalBayar: string;
  nama: string;
  kamarNo: string | null;
  periode: string;
  jumlahBayar: number;
  metodeBayar: string;
  statusBayar: string;
};

export type LaporanStatusKamarRow = {
  noKamar: string;
  tipeKamar: string;
  hargaSewa: number;
  statusKamar: string;
  penghuni: string;
};

export function LaporanPembayaranDoc({
  rows,
  labelPeriode,
  filterStatus,
  dicetak,
}: {
  rows: LaporanPembayaranRow[];
  labelPeriode: string;
  filterStatus: string;
  dicetak: string;
}) {
  const total = rows.reduce((acc, r) => acc + r.jumlahBayar, 0);

  return (
    <Document title={`Laporan Pembayaran ${labelPeriode}`} author="Kos Pondok Muslimah">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Kos Pondok Muslimah · Laporan</Text>
        <Text style={styles.title}>Laporan Pembayaran Sewa</Text>
        <Text style={styles.subtitle}>
          Periode: {labelPeriode}
          {filterStatus ? ` · Status: ${filterStatus}` : ""}
        </Text>
        <Text style={styles.dicetak}>Dicetak: {dicetak}</Text>
        <View style={styles.hr} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total transaksi</Text>
          <Text style={styles.metaValue}>{rows.length}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total nominal</Text>
          <Text style={styles.metaValue}>{formatNominal(total)}</Text>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.kosong}>
            Tidak ada data pembayaran pada periode & filter tersebut.
          </Text>
        ) : (
          <View>
            <View style={styles.headRow}>
              <Text style={[styles.cellHeader, { width: "13%" }]}>Tanggal</Text>
              <Text style={[styles.cellHeader, { width: "24%" }]}>Penghuni</Text>
              <Text style={[styles.cellHeader, { width: "10%" }]}>Kamar</Text>
              <Text style={[styles.cellHeader, { width: "13%" }]}>Periode</Text>
              <Text style={[styles.cellHeader, styles.right, { width: "17%" }]}>
                Jumlah
              </Text>
              <Text style={[styles.cellHeader, { width: "12%" }]}>Metode</Text>
              <Text style={[styles.cellHeader, { width: "11%" }]}>Status</Text>
            </View>
            {rows.map((r, index) => (
              <View key={index} style={styles.row}>
                <Text style={[styles.cell, { width: "13%" }]}>{r.tanggalBayar}</Text>
                <Text style={[styles.cell, { width: "24%" }]}>{r.nama}</Text>
                <Text style={[styles.cell, { width: "10%" }]}>{r.kamarNo ?? "-"}</Text>
                <Text style={[styles.cell, { width: "13%" }]}>{r.periode}</Text>
                <Text style={[styles.cell, styles.right, { width: "17%" }]}>
                  {formatNominal(r.jumlahBayar)}
                </Text>
                <Text style={[styles.cell, { width: "12%" }]}>{r.metodeBayar}</Text>


                <Text style={[styles.cell, { width: "11%" }]}>{r.statusBayar}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          <Text>Kos Pondok Muslimah</Text>
          <Text>Laporan Pembayaran {labelPeriode}</Text>
        </Text>
      </Page>
    </Document>
  );
}

const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatNominal(nilai: number): string {
  return formatIDR.format(nilai);
}

export function LaporanStatusKamarDoc({
  rows,
  dicetak,
}: {
  rows: LaporanStatusKamarRow[];
  dicetak: string;
}) {
  const total = rows.length;
  const terisi = rows.filter((r) => r.statusKamar === "Terisi").length;
  const tersedia = rows.filter((r) => r.statusKamar === "Tersedia").length;
  const perbaikan = rows.filter((r) => r.statusKamar === "Perbaikan").length;

  return (
    <Document title="Laporan Status Kamar" author="Kos Pondok Muslimah">
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Kos Pondok Muslimah · Laporan</Text>
        <Text style={styles.title}>Laporan Status Kamar</Text>
        <Text style={styles.subtitle}>
          Rekapitulasi kondisi kamar beserta penghuninya saat ini.
        </Text>
        <Text style={styles.dicetak}>Dicetak: {dicetak}</Text>
        <View style={styles.hr} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Total kamar</Text>
          <Text style={styles.metaValue}>{total}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Rincian</Text>
          <Text style={styles.metaValue}>
            {tersedia} Tersedia · {terisi} Terisi · {perbaikan} Perbaikan
          </Text>
        </View>

        {rows.length === 0 ? (
          <Text style={styles.kosong}>Belum ada kamar terdaftar.</Text>
        ) : (
          <View>
            <View style={styles.headRow}>
              <Text style={[styles.cellHeader, { width: "14%" }]}>No. Kamar</Text>
              <Text style={[styles.cellHeader, { width: "18%" }]}>Tipe</Text>
              <Text style={[styles.cellHeader, styles.right, { width: "22%" }]}>
                Harga Sewa
              </Text>
              <Text style={[styles.cellHeader, { width: "16%" }]}>Status</Text>
              <Text style={[styles.cellHeader, { width: "30%" }]}>Penghuni</Text>
            </View>
            {rows.map((r, index) => (
              <View key={index} style={styles.row}>
                <Text style={[styles.cell, { width: "14%" }]}>{r.noKamar}</Text>
                <Text style={[styles.cell, { width: "18%" }]}>{r.tipeKamar}</Text>
                <Text style={[styles.cell, styles.right, { width: "22%" }]}>
                  {formatNominal(r.hargaSewa)}
                </Text>
                <Text style={[styles.cell, { width: "16%" }]}>{r.statusKamar}</Text>
                <Text style={[styles.cell, { width: "30%" }]}>
                  {r.penghuni || "-"}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          <Text>Kos Pondok Muslimah</Text>
          <Text>Laporan Status Kamar</Text>
        </Text>
      </Page>
    </Document>
  );
}

/* ============================================================
 * Laporan Keuangan — rekap pendapatan, piutang, & tunggakan.
 * ============================================================ */

export type LaporanKeuanganBulanRow = {
  /** Nama bulan, mis. "September". */
  label: string;
  transaksi: number;
  lunas: number;
  belumLunas: number;
  menunggu: number;
  /** Lunas + Belum Lunas + Menunggu. */
  total: number;
};

export type LaporanKeuanganMetodeRow = {
  metode: string;
  transaksi: number;
  nominal: number;
};

export type LaporanKeuanganTunggakanRow = {
  nama: string;
  kamarNo: string | null;
  jumlahTagihan: number;
  nominal: number;
  jatuhTempo: string;
  status: string;
};

export type LaporanKeuanganRingkasan = {
  /** Jumlah seluruh transaksi (semua status) pada periode. */
  transaksi: number;
  lunasJumlah: number;
  lunasNominal: number;
  menungguJumlah: number;
  menungguNominal: number;
  belumJumlah: number;
  belumNominal: number;
  totalNominal: number;
  terlambatJumlah: number;
  terlambatNominal: number;
  penghuniAktif: number;
};

export function LaporanKeuanganDoc({
  labelPeriode,
  dicetak,
  ringkasan,
  bulanRows,
  metodeRows,
  tunggakanRows,
}: {
  labelPeriode: string;
  dicetak: string;
  ringkasan: LaporanKeuanganRingkasan;
  bulanRows: LaporanKeuanganBulanRow[];
  metodeRows: LaporanKeuanganMetodeRow[];
  tunggakanRows: LaporanKeuanganTunggakanRow[];
}) {
  const totalLunas = bulanRows.reduce((acc, r) => acc + r.lunas, 0);
  const totalBelum = bulanRows.reduce((acc, r) => acc + r.belumLunas, 0);
  const totalMenunggu = bulanRows.reduce((acc, r) => acc + r.menunggu, 0);
  const totalNilai = bulanRows.reduce((acc, r) => acc + r.total, 0);
  const totalMetode = metodeRows.reduce((acc, r) => acc + r.nominal, 0);
  const totalTunggakan = tunggakanRows.reduce((acc, r) => acc + r.nominal, 0);

  return (
    <Document
      title={`Laporan Keuangan ${labelPeriode}`}
      author="Kos Pondok Muslimah"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Kos Pondok Muslimah · Laporan</Text>
        <Text style={styles.title}>Laporan Keuangan</Text>
        <Text style={styles.subtitle}>
          Rekapitulasi pendapatan sewa, piutang, dan tunggakan · Periode:{" "}
          {labelPeriode}
        </Text>
        <Text style={styles.dicetak}>Dicetak: {dicetak}</Text>
        <View style={styles.hr} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Pendapatan diterima (Lunas)</Text>
          <Text style={styles.metaValue}>
            {formatNominal(ringkasan.lunasNominal)} · {ringkasan.lunasJumlah}{" "}
            transaksi
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Piutang (Belum Lunas)</Text>
          <Text style={styles.metaValue}>
            {formatNominal(ringkasan.belumNominal)} · {ringkasan.belumJumlah}{" "}
            tagihan
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Menunggu konfirmasi</Text>
          <Text style={styles.metaValue}>
            {formatNominal(ringkasan.menungguNominal)} ·{" "}
            {ringkasan.menungguJumlah} pengajuan
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Nilai tercatat (seluruh status)</Text>
          <Text style={styles.metaValue}>
            {formatNominal(ringkasan.totalNominal)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Tunggakan lewat jatuh tempo</Text>
          <Text style={styles.metaValue}>
            {formatNominal(ringkasan.terlambatNominal)} ·{" "}
            {ringkasan.terlambatJumlah} tagihan
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Penghuni aktif</Text>
          <Text style={styles.metaValue}>{ringkasan.penghuniAktif} orang</Text>
        </View>

        <Text style={styles.subheading}>Rekap Pendapatan per Bulan</Text>
        <View>
          <View style={styles.headRow}>
            <Text style={[styles.cellHeader, { width: "16%" }]}>Bulan</Text>
            <Text style={[styles.cellHeader, { width: "12%" }]}>Transaksi</Text>
            <Text style={[styles.cellHeader, styles.right, { width: "26%" }]}>
              Lunas
            </Text>
            <Text style={[styles.cellHeader, styles.right, { width: "24%" }]}>
              Belum Lunas
            </Text>
            <Text style={[styles.cellHeader, styles.right, { width: "22%" }]}>
              Menunggu
            </Text>
          </View>
          {bulanRows.map((r, index) => (
            <View key={index} style={styles.row}>
              <Text style={[styles.cell, { width: "16%" }]}>{r.label}</Text>
              <Text style={[styles.cell, { width: "12%" }]}>{r.transaksi}</Text>
              <Text style={[styles.cell, styles.right, { width: "26%" }]}>
                {formatNominal(r.lunas)}
              </Text>
              <Text style={[styles.cell, styles.right, { width: "24%" }]}>
                {formatNominal(r.belumLunas)}
              </Text>
              <Text style={[styles.cell, styles.right, { width: "22%" }]}>
                {formatNominal(r.menunggu)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={[styles.cell, styles.bold, { width: "16%" }]}>
              Total
            </Text>
            <Text style={[styles.cell, styles.bold, { width: "12%" }]}>
              {ringkasan.transaksi}
            </Text>
            <Text
              style={[styles.cell, styles.bold, styles.right, { width: "26%" }]}
            >
              {formatNominal(totalLunas)}
            </Text>
            <Text
              style={[styles.cell, styles.bold, styles.right, { width: "24%" }]}
            >
              {formatNominal(totalBelum)}
            </Text>
            <Text
              style={[styles.cell, styles.bold, styles.right, { width: "22%" }]}
            >
              {formatNominal(totalMenunggu)}
            </Text>
          </View>
          <Text style={[styles.cell, { marginTop: 4 }]}>
            Nilai tercatat seluruh status (Lunas + Belum Lunas + Menunggu):{" "}
            {formatNominal(totalNilai)}
          </Text>
        </View>

        <Text style={styles.footer}>
          <Text>Kos Pondok Muslimah</Text>
          <Text>Laporan Keuangan {labelPeriode}</Text>
        </Text>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.brand}>Kos Pondok Muslimah · Laporan</Text>
        <Text style={styles.title}>Laporan Keuangan (lanjutan)</Text>
        <Text style={styles.subtitle}>
          Rincian pendapatan per metode bayar & daftar tunggakan · Periode:{" "}
          {labelPeriode}
        </Text>
        <Text style={styles.dicetak}>Dicetak: {dicetak}</Text>
        <View style={styles.hr} />

        <Text style={styles.subheading}>Pendapatan per Metode Pembayaran</Text>
        {metodeRows.length === 0 ? (
          <Text style={styles.kosong}>
            Belum ada pembayaran Lunas pada periode ini.
          </Text>
        ) : (
          <View>
            <View style={styles.headRow}>
              <Text style={[styles.cellHeader, { width: "40%" }]}>Metode</Text>
              <Text style={[styles.cellHeader, { width: "20%" }]}>
                Transaksi
              </Text>
              <Text style={[styles.cellHeader, styles.right, { width: "40%" }]}>
                Nominal
              </Text>
            </View>
            {metodeRows.map((r, index) => (
              <View key={index} style={styles.row}>
                <Text style={[styles.cell, { width: "40%" }]}>{r.metode}</Text>
                <Text style={[styles.cell, { width: "20%" }]}>
                  {r.transaksi}
                </Text>
                <Text style={[styles.cell, styles.right, { width: "40%" }]}>
                  {formatNominal(r.nominal)}
                </Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={[styles.cell, styles.bold, { width: "40%" }]}>
                Total pendapatan
              </Text>
              <Text style={[styles.cell, styles.bold, { width: "20%" }]}>
                {ringkasan.lunasJumlah}
              </Text>
              <Text
                style={[styles.cell, styles.bold, styles.right, { width: "40%" }]}
              >
                {formatNominal(totalMetode)}
              </Text>
            </View>
          </View>
        )}

        <Text style={styles.subheading}>Tunggakan per Penghuni</Text>
        {tunggakanRows.length === 0 ? (
          <Text style={styles.kosong}>
            Tidak ada tunggakan pada periode ini.
          </Text>
        ) : (
          <View>
            <View style={styles.headRow}>
              <Text style={[styles.cellHeader, { width: "26%" }]}>
                Penghuni
              </Text>
              <Text style={[styles.cellHeader, { width: "10%" }]}>Kamar</Text>
              <Text style={[styles.cellHeader, { width: "8%" }]}>Tagihan</Text>
              <Text style={[styles.cellHeader, styles.right, { width: "22%" }]}>
                Nominal
              </Text>
              <Text style={[styles.cellHeader, { width: "20%" }]}>
                Jatuh Tempo
              </Text>
              <Text style={[styles.cellHeader, { width: "14%" }]}>Ket.</Text>
            </View>
            {tunggakanRows.map((r, index) => (
              <View key={index} style={styles.row}>
                <Text style={[styles.cell, { width: "26%" }]}>{r.nama}</Text>
                <Text style={[styles.cell, { width: "10%" }]}>
                  {r.kamarNo ?? "—"}
                </Text>
                <Text style={[styles.cell, { width: "8%" }]}>
                  {r.jumlahTagihan}
                </Text>
                <Text style={[styles.cell, styles.right, { width: "22%" }]}>
                  {formatNominal(r.nominal)}
                </Text>
                <Text style={[styles.cell, { width: "20%" }]}>
                  {r.jatuhTempo}
                </Text>
                <Text style={[styles.cell, { width: "14%" }]}>{r.status}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={[styles.cell, styles.bold, { width: "26%" }]}>
                Total tunggakan
              </Text>
              <Text style={[styles.cell, { width: "10%" }]} />
              <Text style={[styles.cell, styles.bold, { width: "8%" }]}>
                {ringkasan.belumJumlah}
              </Text>
              <Text
                style={[styles.cell, styles.bold, styles.right, { width: "22%" }]}
              >
                {formatNominal(totalTunggakan)}
              </Text>
              <Text style={[styles.cell, { width: "20%" }]} />
              <Text style={[styles.cell, { width: "14%" }]} />
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          <Text>Kos Pondok Muslimah</Text>
          <Text>Laporan Keuangan {labelPeriode}</Text>
        </Text>
      </Page>
    </Document>
  );
}


