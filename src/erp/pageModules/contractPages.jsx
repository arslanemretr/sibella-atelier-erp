import React from "react";
import dayjs from "dayjs";
import { DatePicker } from "antd";
import { DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, FilterOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tooltip, Typography, message } from "antd";
import { createContract, deleteContract, listContractsFresh, updateContract } from "../contractsData";
import { listSuppliersFresh } from "../suppliersData";

const { Title, Text } = Typography;

function preventRowClick(event) {
  event.stopPropagation();
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("PDF dosyasi okunamadi."));
    reader.readAsDataURL(file);
  });
}

export function ContractsPage() {
  const [records, setRecords] = React.useState([]);
  const [tableLoading, setTableLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [pdfModalOpen, setPdfModalOpen] = React.useState(false);
  const [filterModalOpen, setFilterModalOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [activePdf, setActivePdf] = React.useState(null);
  const [activeRecord, setActiveRecord] = React.useState(null);
  const [uploadedPdf, setUploadedPdf] = React.useState({ pdfName: "", pdfDataUrl: "" });
  const [filters, setFilters] = React.useState({
    search: "",
    supplierId: undefined,
  });
  const [form] = Form.useForm();
  const [supplierOptions, setSupplierOptions] = React.useState([]);

  const refreshRecords = React.useCallback(async () => {
    try {
      setTableLoading(true);
      const [contracts, suppliers] = await Promise.all([
        listContractsFresh(),
        listSuppliersFresh(),
      ]);
      setRecords(contracts);
      setSupplierOptions(
        suppliers
          .filter((item) => item.status !== "Pasif")
          .map((item) => ({
            value: item.id,
            label: item.company,
          })),
      );
    } catch (error) {
      message.error(error?.message || "Sozlesme listesi yuklenemedi.");
    } finally {
      setTableLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshRecords();
  }, [refreshRecords]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      supplierId: undefined,
    });
  };

  const openCreateModal = () => {
    setActiveRecord(null);
    setUploadedPdf({ pdfName: "", pdfDataUrl: "" });
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (record) => {
    setActiveRecord(record);
    setUploadedPdf({
      pdfName: record.pdfName || "",
      pdfDataUrl: record.pdfDataUrl || "",
    });
    form.setFieldsValue({
      supplierId: record.supplierId,
      startDate: record.startDate ? dayjs(record.startDate) : null,
      endDate: record.endDate ? dayjs(record.endDate) : null,
      commissionRate: Number(record.commissionRate || 0),
    });
    setModalOpen(true);
  };

  const handlePdfFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      message.error("Lutfen PDF dosyasi secin.");
      event.target.value = "";
      return;
    }

    try {
      const pdfDataUrl = await readFileAsDataUrl(file);
      setUploadedPdf({
        pdfName: file.name,
        pdfDataUrl,
      });
      message.success("PDF yuklendi.");
    } catch {
      message.error("PDF okunurken hata olustu.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const startDate = values.startDate?.format("YYYY-MM-DD");
      const endDate = values.endDate?.format("YYYY-MM-DD");

      if (startDate && endDate && dayjs(endDate).isBefore(dayjs(startDate), "day")) {
        message.error("Bitis tarihi baslangic tarihinden once olamaz.");
        return;
      }

      const payload = {
        supplierId: values.supplierId,
        startDate,
        endDate,
        commissionRate: Number(values.commissionRate || 0),
        pdfName: uploadedPdf.pdfName,
        pdfDataUrl: uploadedPdf.pdfDataUrl,
      };

      if (activeRecord?.id) {
        updateContract(activeRecord.id, payload);
        message.success("Sozlesme guncellendi.");
      } else {
        createContract(payload);
        message.success("Sozlesme kaydedildi.");
      }

      setModalOpen(false);
      form.resetFields();
      setUploadedPdf({ pdfName: "", pdfDataUrl: "" });
      setActiveRecord(null);
      await refreshRecords();
    } catch {
      // form validation handles error display
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (recordId) => {
    deleteContract(recordId);
    await refreshRecords();
    message.success("Sozlesme silindi.");
  };

  const filteredRecords = records.filter((record) => {
    const normalizedSearch = filters.search.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      [record.supplierName, record.pdfName, record.startDate, record.endDate]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    const matchesSupplier = !filters.supplierId || filters.supplierId === "all" || record.supplierId === filters.supplierId;
    return matchesSearch && matchesSupplier;
  });

  const handleExport = () => {
    const header = ["Firma", "Baslangic", "Bitis", "Komisyon (%)", "PDF"];
    const rows = filteredRecords.map((item) => [
      item.supplierName || "",
      item.startDate || "",
      item.endDate || "",
      Number(item.commissionRate || 0).toFixed(2),
      item.pdfName || "",
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sozlesmeler.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns = [
    {
      title: "Firma",
      dataIndex: "supplierName",
      key: "supplierName",
      sorter: (a, b) => String(a.supplierName || "").localeCompare(String(b.supplierName || ""), "tr"),
    },
    {
      title: "Baslangic",
      dataIndex: "startDate",
      key: "startDate",
      sorter: (a, b) => String(a.startDate || "").localeCompare(String(b.startDate || ""), "tr"),
      render: (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "-"),
    },
    {
      title: "Bitis",
      dataIndex: "endDate",
      key: "endDate",
      sorter: (a, b) => String(a.endDate || "").localeCompare(String(b.endDate || ""), "tr"),
      render: (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "-"),
    },
    {
      title: "Komisyon (%)",
      dataIndex: "commissionRate",
      key: "commissionRate",
      sorter: (a, b) => Number(a.commissionRate || 0) - Number(b.commissionRate || 0),
      render: (value) => `${Number(value || 0).toFixed(2)}%`,
    },
    {
      title: "PDF",
      dataIndex: "pdfName",
      key: "pdfName",
      render: (_, record) =>
        record.pdfDataUrl ? (
          <Space>
            <Text>{record.pdfName || "Sozlesme.pdf"}</Text>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                setActivePdf(record);
                setPdfModalOpen(true);
              }}
            >
              Ac
            </Button>
          </Space>
        ) : (
          "-"
        ),
    },
    {
      title: "Islemler",
      key: "actions",
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Düzenle">
            <Button size="small" className="erp-icon-btn erp-icon-btn-view" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditModal(record); }} />
          </Tooltip>
          <Popconfirm title="Sozlesme silinsin mi?" okText="Sil" cancelText="Vazgec" onConfirm={() => handleDelete(record.id)}>
            <span onClick={preventRowClick}>
              <Tooltip title="Sil">
                <Button size="small" className="erp-icon-btn erp-icon-btn-delete" icon={<DeleteOutlined />} />
              </Tooltip>
            </span>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={20} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 6 }}>Sozlesmeler</Title>
          <Text type="secondary">Konsinye urun alim sozlesmeleri firma, tarih araligi ve komisyon orani ile takip edilir.</Text>
        </div>
        <Space>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Sozlesme Ekle</Button>
        </Space>
      </div>

      <Card bordered={false} className="erp-list-toolbar-card">
        <div className="erp-list-toolbar erp-product-toolbar-single">
          <Space wrap className="erp-product-toolbar-actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Yeni Sozlesme</Button>
            <Button icon={<ReloadOutlined />} onClick={() => { refreshRecords(); message.success("Sozlesmeler yenilendi."); }}>Yenile</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Excel'e Aktar</Button>
          </Space>

          <div className="erp-product-toolbar-search">
            <Input
              prefix={<SearchOutlined style={{ color: "#9aa0a6" }} />}
              placeholder="Firma"
              value={filters.search}
              onChange={(event) => handleFilterChange("search", event.target.value)}
              allowClear
            />
            <Button icon={<FilterOutlined />} onClick={() => setFilterModalOpen(true)} />
          </div>
        </div>
      </Card>

      <Card title="Tum Sozlesmeler" className="erp-list-table-card">
        <Table
          rowKey="id"
          loading={tableLoading}
          columns={columns}
          dataSource={filteredRecords}
          pagination={false}
          locale={{ emptyText: "Henuz sozlesme kaydi bulunmuyor." }}
          onRow={(record) => ({
            onClick: () => openEditModal(record),
          })}
          rowClassName={() => "erp-clickable-row"}
        />
        <div className="erp-table-footer">
          <Space>
            <span>Sayfa Boyutu:</span>
            <Select
              defaultValue="100"
              size="small"
              style={{ width: 84 }}
              options={["25", "50", "100"].map((value) => ({ value, label: value }))}
            />
          </Space>
          <Space size={18}>
            <span>1 - {filteredRecords.length} / {filteredRecords.length}</span>
            <span>Sayfa 1 / 1</span>
          </Space>
        </div>
      </Card>

      <Modal title="Gelismis Filtreler" open={filterModalOpen} onCancel={() => setFilterModalOpen(false)} footer={null}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col span={24}>
              <Form.Item label="Firma">
                <Select
                  value={filters.supplierId}
                  onChange={(value) => handleFilterChange("supplierId", value)}
                  options={[{ value: "all", label: "Tumu" }, ...supplierOptions]}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Button onClick={handleResetFilters}>Filtreleri Temizle</Button>
            <Button type="primary" onClick={() => setFilterModalOpen(false)}>Uygula</Button>
          </Space>
        </Space>
      </Modal>

      <Modal
        title={activeRecord ? "Sozlesme Duzenle" : "Yeni Sozlesme"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setActiveRecord(null);
          setUploadedPdf({ pdfName: "", pdfDataUrl: "" });
        }}
        onOk={handleSubmit}
        okText={activeRecord ? "Guncelle" : "Kaydet"}
        cancelText="Vazgec"
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="supplierId"
            label="Ilgili Firma"
            rules={[{ required: true, message: "Firma secin." }]}
          >
            <Select
              placeholder="Firma secin"
              options={supplierOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="startDate"
                label="Sozlesme Baslangic Tarihi"
                rules={[{ required: true, message: "Baslangic tarihi secin." }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="endDate"
                label="Sozlesme Bitis Tarihi"
                rules={[{ required: true, message: "Bitis tarihi secin." }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="commissionRate"
            label="Komisyon Orani (%)"
            rules={[{ required: true, message: "Komisyon orani girin." }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} max={100} step={0.01} precision={2} />
          </Form.Item>
          <Form.Item label="Sozlesme PDF Yukleme">
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              <input type="file" accept="application/pdf" onChange={handlePdfFileChange} />
              <Text type="secondary">
                {uploadedPdf.pdfName ? `Yuklenen dosya: ${uploadedPdf.pdfName}` : "PDF dosyasi secilmedi. Isterseniz bos birakabilirsiniz."}
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={activePdf?.pdfName || "Sozlesme PDF"}
        open={pdfModalOpen}
        onCancel={() => setPdfModalOpen(false)}
        footer={null}
        width={960}
      >
        {activePdf?.pdfDataUrl ? (
          <object data={activePdf.pdfDataUrl} type="application/pdf" width="100%" height="640">
            <a href={activePdf.pdfDataUrl} target="_blank" rel="noreferrer">PDF dosyasini yeni sekmede ac</a>
          </object>
        ) : (
          <Text>PDF bulunamadi.</Text>
        )}
      </Modal>
    </Space>
  );
}


