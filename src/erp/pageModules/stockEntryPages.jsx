import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Card, Col, Descriptions, Drawer, Form, Grid, Input, InputNumber, Row, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createStockEntry, getStockEntryFresh, listStockEntriesFresh, updateStockEntry } from "../stockEntriesData";
import { listSuppliersFresh } from "../suppliersData";
import { listProductsRawFresh } from "../productsData";

const { Title, Text } = Typography;

function downloadWorkbook(rows, sheetName, fileName) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function openDetailFromRow(setSelected, setOpen, record) {
  setSelected(record);
  setOpen(true);
}

export function StockEntryEditorPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { stockEntryId } = useParams();
  const isEditMode = Boolean(stockEntryId);
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(false);
  const stockImportInputRef = React.useRef(null);
  const [supplierOptions, setSupplierOptions] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [productOptions, setProductOptions] = React.useState([]);
  const stockTypeOptions = ["Urun", "Hammadde", "Ambalaj"].map((value) => ({ value, label: value }));
  const sourceTypeOptions = ["Konsinye", "Uretim", "Sayim Duzeltme", "Depo Transferi"].map((value) => ({ value, label: value }));
  const statusOptions = ["Alim Planlandi", "Taslak", "Tamamlandi"].map((value) => ({ value, label: value }));

  React.useEffect(() => {
    let cancelled = false;
    const baseValues = {
      documentNo: `STK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      sourcePartyId: undefined,
      date: new Date().toISOString().slice(0, 10),
      stockType: "Urun",
      sourceType: "Konsinye",
      status: "Taslak",
      note: "",
      lines: [{ productId: undefined, quantity: 1, unitCost: 0, note: "" }],
    };

    const loadPageData = async () => {
      try {
        setPageLoading(true);
        const fetches = [listSuppliersFresh({ slim: true }), listProductsRawFresh()];
        if (isEditMode) fetches.push(getStockEntryFresh(stockEntryId));

        const [suppliers, nextProducts, stockEntry] = await Promise.all(fetches);

        if (cancelled) return;

        setSupplierOptions(suppliers.map((item) => ({ value: item.id, label: item.company })));
        setProducts(nextProducts);
        setProductOptions(nextProducts.map((item) => ({
          value: item.id,
          label: `${item.code} - ${item.name}`,
        })));

        if (!isEditMode) {
          form.setFieldsValue(baseValues);
          return;
        }

        if (!stockEntry) {
          message.error("Stok giris kaydi bulunamadi.");
          navigate("/stock/entry");
          return;
        }

        form.setFieldsValue({
          ...baseValues,
          ...stockEntry,
          lines: stockEntry.lines?.length ? stockEntry.lines : baseValues.lines,
        });
      } catch (error) {
        if (!cancelled) {
          message.error(error?.message || "Stok giris verileri alinamadi.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    };

    void loadPageData();

    return () => {
      cancelled = true;
    };
  }, [form, isEditMode, navigate, stockEntryId]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const savedEntry = await (isEditMode ? updateStockEntry(stockEntryId, values) : createStockEntry(values));
      message.success(isEditMode ? "Stok girisi guncellendi." : "Stok girisi kaydedildi.");
      navigate(`/stock/entry/${savedEntry.id}`);
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Kayit islemi basarisiz oldu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadStockTemplate = () => {
    downloadWorkbook(
      [["productCode", "quantity"], ["SOLE0001", "5"]],
      "StokKalemleri",
      "stok-giris-sablonu.xlsx",
    );
    message.success("Stok giris sablonu indirildi.");
  };

  const handleStockImportClick = () => {
    stockImportInputRef.current?.click();
  };

  const handleStockImportFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
      const [headerRow, ...dataRows] = rows;

      if (!headerRow?.length) {
        message.error("Excel dosyasi bos gorunuyor.");
        return;
      }

      const headers = headerRow.map((item) => String(item).trim());
      const productCodeIndex = headers.findIndex((item) => item === "productCode");
      const quantityIndex = headers.findIndex((item) => item === "quantity");

      if (productCodeIndex === -1 || quantityIndex === -1) {
        message.error("Excel basliklari productCode ve quantity olmalidir.");
        return;
      }

      const productMap = new Map(products.map((item) => [String(item.code || "").trim().toUpperCase(), item]));
      const importedLines = [];
      const missingCodes = [];

      dataRows
        .filter((row) => row.some((cell) => String(cell ?? "").trim()))
        .forEach((row) => {
          const productCode = String(row[productCodeIndex] || "").trim().toUpperCase();
          const quantity = Number(row[quantityIndex] || 0);

          if (!productCode || quantity <= 0) {
            return;
          }

          const product = productMap.get(productCode);
          if (!product) {
            missingCodes.push(productCode);
            return;
          }

          importedLines.push({
            productId: product.id,
            quantity,
            unitCost: Number(product.cost || 0),
            note: "",
          });
        });

      if (!importedLines.length) {
        message.error(missingCodes.length ? `Urunler bulunamadi: ${missingCodes.join(", ")}` : "Aktarilacak gecerli satir bulunamadi.");
        return;
      }

      form.setFieldValue("lines", importedLines);

      if (missingCodes.length) {
        message.warning(`Bazi urun kodlari bulunamadi: ${missingCodes.join(", ")}`);
      } else {
        message.success(`${importedLines.length} stok kalemi excelden eklendi.`);
      }
    } catch {
      message.error("Excel dosyasi okunurken hata olustu.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ margin: isMobile ? 0 : undefined, marginBottom: isMobile ? 0 : 6 }}>{isEditMode ? "Stok Girisi Duzenle" : "Stok Giris Ekrani"}</Title>
        </div>
        <Space>
          <Button onClick={() => navigate("/stock/entry")}>{isMobile ? "Geri" : "Ana Kayitlara Don"}</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Kaydet</Button>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <input
          ref={stockImportInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={(event) => {
            void handleStockImportFileChange(event);
          }}
        />
        <div className="erp-form-stack">
          <Card title="Genel Bilgiler" loading={pageLoading}>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={8}><Form.Item name="sourcePartyId" label="Stok Teslim Eden"><Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Seciniz" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="documentNo" label="Belge No" rules={[{ required: true, message: "Belge no zorunludur." }]}><Input placeholder="STK-2026-001" /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="stockType" label="Stok Cesidi"><Select options={stockTypeOptions} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="sourceType" label="Giris Kaynagi"><Select options={sourceTypeOptions} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="status" label="Durum"><Select options={statusOptions} /></Form.Item></Col>
              <Col xs={24} md={8}><Form.Item name="note" label="Not"><Input placeholder="Aciklama" /></Form.Item></Col>
            </Row>
          </Card>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <Card
                loading={pageLoading}
                title="Stok Kalemleri"
                extra={(
                  <Space wrap>
                    <Button onClick={handleDownloadStockTemplate}>Sablon Indir</Button>
                    <Button onClick={handleStockImportClick}>Excelden Aktar</Button>
                    <Button icon={<PlusOutlined />} onClick={() => add({ productId: undefined, quantity: 1, unitCost: 0, note: "" })}>Satir Ekle</Button>
                  </Space>
                )}
              >
                {isMobile ? (
                  fields.length === 0 ? (
                    <Text type="secondary">Henüz kalem eklenmedi.</Text>
                  ) : (
                    <Space direction="vertical" size={10} style={{ width: "100%" }}>
                      {fields.map((field, idx) => (
                        <div key={field.key} style={{ padding: 12, borderRadius: 10, border: "1px solid #f0f0f0", background: "#fff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <Text strong>Kalem {idx + 1}</Text>
                            <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                          </div>
                          <Form.Item name={[field.name, "productId"]} rules={[{ required: true, message: "Urun seciniz." }]} style={{ marginBottom: 8 }}>
                            <Select showSearch placeholder="Urun seciniz" options={productOptions} optionFilterProp="label" filterOption={(input, option) => String(option?.label || "").toLowerCase().includes(input.toLowerCase())} />
                          </Form.Item>
                          <div style={{ display: "flex", gap: 8 }}>
                            <Form.Item name={[field.name, "quantity"]} label="Miktar" rules={[{ required: true, message: "Miktar" }]} style={{ flex: 1, marginBottom: 8 }}>
                              <InputNumber min={1} style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item name={[field.name, "unitCost"]} label="Birim Maliyet" rules={[{ required: true, message: "Maliyet" }]} style={{ flex: 1, marginBottom: 8 }}>
                              <InputNumber min={0} style={{ width: "100%" }} />
                            </Form.Item>
                          </div>
                          <Form.Item name={[field.name, "note"]} style={{ marginBottom: 0 }}>
                            <Input placeholder="Satir notu" />
                          </Form.Item>
                        </div>
                      ))}
                    </Space>
                  )
                ) : (
                <Table
                  size="small"
                  rowKey="key"
                  pagination={{ pageSize: 20, showSizeChanger: false, hideOnSinglePage: true }}
                  dataSource={fields.map((field) => ({ key: field.key, field }))}
                  columns={[
                    {
                      title: "Urun",
                      key: "product",
                      width: 260,
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "productId"]} rules={[{ required: true, message: "Urun seciniz." }]}>
                          <Select
                            showSearch
                            placeholder="Urun seciniz"
                            options={productOptions}
                            optionFilterProp="label"
                            filterOption={(input, option) => String(option?.label || "").toLowerCase().includes(input.toLowerCase())}
                          />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Miktar",
                      key: "quantity",
                      width: 100,
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "quantity"]} rules={[{ required: true, message: "Miktar girin." }]}>
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Birim Maliyet",
                      key: "unitCost",
                      width: 130,
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "unitCost"]} rules={[{ required: true, message: "Birim maliyet girin." }]}>
                          <InputNumber min={0} style={{ width: "100%" }} />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Not",
                      key: "note",
                      width: 180,
                      render: (_, record) => (
                        <Form.Item name={[record.field.name, "note"]}>
                          <Input placeholder="Satir notu" />
                        </Form.Item>
                      ),
                    },
                    {
                      title: "Islemler",
                      key: "actions",
                      width: 110,
                      render: (_, record) => (
                        <Tooltip title="Sil"><Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} onClick={() => remove(record.field.name)} /></Tooltip>
                      ),
                    },
                  ]}
                />
                )}
              </Card>
            )}
          </Form.List>
        </div>
      </Form>
    </Space>
  );
}

export function StockEntryListPage() {
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [createForm] = Form.useForm();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedEntry, setSelectedEntry] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [filters, setFilters] = React.useState({
    search: "",
    status: undefined,
    sourceType: undefined,
  });
  const createStatusOptions = ["Alim Planlandi", "Taslak", "Tamamlandi"].map((value) => ({ value, label: value }));
  const statusOptions = ["Tumu", "Alim Planlandi", "Taslak", "Tamamlandi"].map((value) => ({ value, label: value }));
  const stockTypeOptions = ["Urun", "Hammadde", "Ambalaj"].map((value) => ({ value, label: value }));
  const sourceTypeOptions = ["Tumu", "Konsinye", "Uretim", "Sayim Duzeltme", "Depo Transferi"].map((value) => ({ value, label: value }));
  const createSourceTypeOptions = ["Konsinye", "Uretim", "Sayim Duzeltme", "Depo Transferi"].map((value) => ({ value, label: value }));

  React.useEffect(() => {
    createForm.setFieldsValue({
      documentNo: `STK-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      sourcePartyId: undefined,
      date: new Date().toISOString().slice(0, 10),
      stockType: "Urun",
      sourceType: "Konsinye",
      status: "Taslak",
      note: "",
    });
  }, [createForm]);

  const queryClient = useQueryClient();
  const { data: entryData, isLoading, isFetching, error } = useQuery({
    queryKey: ["stock", "entries"],
    queryFn: async () => {
      const [suppliers, products, nextEntries] = await Promise.all([
        listSuppliersFresh({ slim: true }),
        listProductsRawFresh(),
        listStockEntriesFresh(),
      ]);
      const productMap = Object.fromEntries(products.map((item) => [item.id, item]));
      const mappedEntries = nextEntries.map((entry) => ({
        ...entry,
        lines: (entry.lines || []).map((line) => ({
          ...line,
          productCode: line.productCode || productMap[line.productId]?.code || "-",
          productName: line.productName || productMap[line.productId]?.name || "-",
        })),
      }));
      return { entries: mappedEntries, supplierOptions: suppliers.map((item) => ({ value: item.id, label: item.company })) };
    },
  });
  React.useEffect(() => { if (error) message.error(error?.message || "Stok girisleri yuklenemedi."); }, [error]);
  const entries = entryData?.entries || [];
  const supplierOptions = entryData?.supplierOptions || [];
  const tableLoading = isLoading || isFetching;
  const refreshEntries = React.useCallback(() => queryClient.invalidateQueries({ queryKey: ["stock", "entries"] }), [queryClient]);

  const handleCreateMainRecord = async () => {
    try {
      setCreating(true);
      const values = await createForm.validateFields();
      const savedEntry = await createStockEntry({
        ...values,
        lines: [],
      });
      await refreshEntries();
      message.success("Ana kayit olusturuldu. Kalem girisi ekranina yonlendiriliyorsunuz.");
      navigate(`/stock/entry/${savedEntry.id}`);
    } catch (error) {
      if (!error?.errorFields) {
        message.error(error?.message || "Kayit islemi basarisiz oldu.");
      }
    } finally {
      setCreating(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [entry.documentNo, entry.sourcePartyName, entry.note, entry.stockType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesStatus = !filters.status || filters.status === "Tumu" || entry.status === filters.status;
    const matchesSourceType = !filters.sourceType || filters.sourceType === "Tumu" || entry.sourceType === filters.sourceType;
    return matchesSearch && matchesStatus && matchesSourceType;
  });

  const columns = [
    {
      title: "Belge No",
      dataIndex: "documentNo",
      key: "documentNo",
      width: 160,
      sorter: (a, b) => a.documentNo.localeCompare(b.documentNo, "tr"),
      render: (value, record) => (
        <button
          type="button"
          className="erp-link-button"
          onClick={(event) => {
            event.stopPropagation();
            navigate(`/stock/entry/${record.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
    { title: "Tarih", dataIndex: "date", key: "date", width: 130, sorter: (a, b) => a.date.localeCompare(b.date, "tr") },
    { title: "Teslim Eden", dataIndex: "sourcePartyName", key: "sourcePartyName", width: 160, sorter: (a, b) => a.sourcePartyName.localeCompare(b.sourcePartyName, "tr") },
    { title: "Kaynak", dataIndex: "sourceType", key: "sourceType", width: 140, sorter: (a, b) => a.sourceType.localeCompare(b.sourceType, "tr") },
    { title: "Kalem", dataIndex: "lineCount", key: "lineCount", width: 80, sorter: (a, b) => a.lineCount - b.lineCount },
    { title: "Toplam", dataIndex: "totalAmountDisplay", key: "totalAmountDisplay", width: 130, sorter: (a, b) => a.totalAmount - b.totalAmount },
    {
      title: "Durum",
      dataIndex: "status",
      key: "status",
      width: 110,
      sorter: (a, b) => String(a.status || "").localeCompare(String(b.status || ""), "tr"),
      render: (value) => <Tag color={value === "Tamamlandi" ? "green" : value === "Taslak" ? "gold" : "blue"}>{value || "-"}</Tag>,
    },
    {
      title: "Islemler",
      key: "actions",
      width: 80,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Düzenle">
            <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/stock/entry/${record.id}`); }} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space vertical size={20} style={{ width: "100%" }}>
      <div>
        <Title level={3} style={{ marginBottom: 6 }}>Stok Giris Ana Kayitlar</Title>
      </div>

      <Card
        title="Ana Kayit Bilgileri"
        extra={<Button type="primary" onClick={handleCreateMainRecord} loading={creating}>Kalem Girisine Gec</Button>}
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}><Form.Item name="sourcePartyId" label="Stok Teslim Eden"><Select options={supplierOptions} showSearch optionFilterProp="label" placeholder="Seciniz" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="date" label="Tarih" rules={[{ required: true, message: "Tarih zorunludur." }]}><Input type="date" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="documentNo" label="Belge No" rules={[{ required: true, message: "Belge no zorunludur." }]}><Input placeholder="STK-2026-001" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="stockType" label="Stok Cesidi"><Select options={stockTypeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="sourceType" label="Giris Kaynagi"><Select options={createSourceTypeOptions} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="status" label="Durum"><Select options={createStatusOptions} /></Form.Item></Col>
            <Col xs={24}><Form.Item name="note" label="Not"><Input placeholder="Aciklama" /></Form.Item></Col>
          </Row>
        </Form>
      </Card>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void refreshEntries()}>Yenile</Button>
          </Space>

          <div className="erp-list-toolbar-filters">
            <Form.Item label="Belge / Tedarikci" style={{ marginBottom: 0 }}>
              <Input
                prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
                placeholder="Ara"
                value={filters.search}
                onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                allowClear
              />
            </Form.Item>
            <Form.Item label="Durum" style={{ marginBottom: 0 }}>
              <Select value={filters.status} onChange={(value) => setFilters((prev) => ({ ...prev, status: value }))} options={statusOptions} allowClear />
            </Form.Item>
            <Form.Item label="Giris Kaynagi" style={{ marginBottom: 0 }}>
              <Select value={filters.sourceType} onChange={(value) => setFilters((prev) => ({ ...prev, sourceType: value }))} options={sourceTypeOptions} allowClear />
            </Form.Item>
          </div>
        </div>
      </Card>

      <Card title={`Ana Kayit Listesi${isMobile ? ` (${filteredEntries.length})` : ""}`} className="erp-list-table-card" styles={isMobile ? { body: { padding: 12 } } : undefined}>
        {isMobile ? (
          filteredEntries.length === 0 ? (
            <Text type="secondary">Henuz stok giris ana kaydi bulunmuyor.</Text>
          ) : (
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              {filteredEntries.map((record) => (
                <div
                  key={record.id}
                  onClick={() => openDetailFromRow(setSelectedEntry, setDetailOpen, record)}
                  style={{ padding: 14, borderRadius: 12, border: "1px solid #f0f0f0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 15 }}>{record.documentNo}</Text>
                    <Tag style={{ marginInlineEnd: 0 }}>{record.status}</Tag>
                  </div>
                  <Text style={{ display: "block" }}>{record.sourcePartyName || "-"}</Text>
                  <Text type="secondary" style={{ fontSize: 13, display: "block", marginTop: 4 }}>{record.date} · {record.sourceType} · {record.lineCount} kalem</Text>
                  <div style={{ textAlign: "right", marginTop: 4 }}>
                    <Text strong style={{ color: "#1677ff" }}>{record.totalAmountDisplay}</Text>
                  </div>
                </div>
              ))}
            </Space>
          )
        ) : (
        <>
        <Table
          size="small"
          rowKey="id"
          loading={tableLoading}
          columns={columns}
          dataSource={filteredEntries}
          pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: ["25", "50", "100"], hideOnSinglePage: true }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "Henuz stok giris ana kaydi bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => openDetailFromRow(setSelectedEntry, setDetailOpen, record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Toplam Kayit:</span>
            <strong>{filteredEntries.length}</strong>
          </Space>
        </div>
        </>
        )}
      </Card>

      <Drawer title="Stok Giris Detayi" placement="right" styles={{ wrapper: { width: isMobile ? "100%" : 420 } }} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {selectedEntry ? (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Belge No">{selectedEntry.documentNo}</Descriptions.Item>
              <Descriptions.Item label="Tarih">{selectedEntry.date}</Descriptions.Item>
              <Descriptions.Item label="Teslim Eden">{selectedEntry.sourcePartyName}</Descriptions.Item>
              <Descriptions.Item label="Giris Kaynagi">{selectedEntry.sourceType}</Descriptions.Item>
              <Descriptions.Item label="Durum">{selectedEntry.status}</Descriptions.Item>
              <Descriptions.Item label="Kalem">{selectedEntry.lineCount}</Descriptions.Item>
              <Descriptions.Item label="Toplam">{selectedEntry.totalAmountDisplay}</Descriptions.Item>
              <Descriptions.Item label="Not">{selectedEntry.note || "-"}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="primary" icon={<EditOutlined />} onClick={() => { setDetailOpen(false); navigate(`/stock/entry/${selectedEntry?.id}`); }}>Düzenle</Button>
            </div>
          </>
        ) : null}
      </Drawer>
    </Space>
  );
}
