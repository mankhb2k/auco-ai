# Kịch bản demo RAG cho Ban giám khảo

## Mục tiêu

Chứng minh hệ thống không chỉ chạy một chuỗi Agent, mà mỗi Expert còn:

- lấy dữ liệu khách hàng từ nguồn nghiệp vụ giả lập;
- tra cứu đúng domain RAG;
- trích dẫn quy trình có phiên bản và hiệu lực;
- tổng hợp thành nhận định tham khảo;
- đề xuất nhãn để nhân viên xác nhận và trình Giám đốc.

> Bộ chính sách `shb-hq://` là dữ liệu nội bộ giả lập cho bài thi, không phải văn bản thật của SHB. Bảy tài liệu có URL công khai (Thông tư 39/2016, Thông tư 11/2021, Luật PCRT 14/2022, Nghị định 21/2021, ba trang sản phẩm SHB) là **nội dung thật crawl từ nguồn công khai**.

## Chuẩn bị

1. Chạy seed hoặc đồng bộ từ màn hình **Tri thức**.
2. Kiểm tra kho có 39 tài liệu: `credit 10`, `legal 7`, `collateral 8`, `product 10`, `ops 4`.
3. Chọn tài khoản nhân viên tín dụng đã được phân hồ sơ.
4. Mở **Hồ sơ vay** và giữ panel **Trợ lý AI** ở cột phải.

## Kịch bản 1 — Vay mua nhà, hồ sơ đạt sơ bộ

Prompt mẫu:

```text
Đánh giá khoản vay mua nhà 2 tỷ của Nguyễn Văn An. Kiểm tra CIC, DTI, AML,
LTV tài sản bảo đảm và đề xuất sản phẩm phù hợp.
```

Điểm cần trình diễn:

- Credit tra CIC/khả năng trả nợ và cite `QĐ-SHB-TD-05/2025`, `QT-SHB-TD-CN-07`.
- Legal cite checklist KYC.
- Collateral tính LTV và cite `CS-SHB-TSĐB-2.1`.
- Product cite Home Loan 2026 / ma trận sản phẩm.
- Final answer đề xuất `proceed_with_conditions`.
- AI đề xuất nhãn **Đề xuất phê duyệt**; nhân viên có thể bấm gắn nhãn ngay trong chat.

## Kịch bản 2 — Doanh nghiệp 50 tỷ, vượt thẩm quyền chi nhánh

Prompt mẫu:

```text
Đánh giá khoản vay 50 tỷ mở rộng nhà máy của SHB Mekong; đối chiếu vốn tự có,
dòng tiền, LTV nhà xưởng và thẩm quyền phê duyệt.
```

Điểm cần trình diễn:

- Credit cite chính sách SME và DSCR.
- Collateral cite LTV nhà xưởng 75% và haircut nhà xưởng chuyên dụng.
- AI giải thích chính sách nội bộ có thể khắt hơn nguồn pháp luật công khai.
- Ma trận thẩm quyền cite `QĐ-SHB-PD-02/2026`: Giám đốc chi nhánh chỉ duyệt tối đa 5 tỷ.
- Nếu Giám đốc bấm phê duyệt, hồ sơ chuyển `escalated`, không giải ngân tự động.

## Kịch bản 3 — Giao dịch ngoại tệ có cảnh báo AML

Prompt mẫu:

```text
Đánh giá khách hàng muốn vay và chuyển đổi khoản tiền lớn sang USD.
Kiểm tra mục đích vốn, KYC, AML và các bước kiểm tra thủ công.
```

Điểm cần trình diễn:

- Legal cite `CS-SHB-AML-02/2025`, `QT-SHB-AML-05` và Luật 14/2022/QH15.
- Agent không kết luận khách hàng “rửa tiền”.
- Final answer nêu rủi ro và đề xuất `manual_review`.
- AI đề xuất nhãn **Cần rà soát**.

## Kịch bản 4 — Thiếu hồ sơ tài sản bảo đảm

Prompt mẫu:

```text
Đánh giá khoản vay có tài sản bảo đảm nhưng thiếu giấy chứng nhận sở hữu,
định giá đã quá hạn và chưa đăng ký giao dịch bảo đảm.
```

Điểm cần trình diễn:

- Collateral cite checklist quyền sở hữu, chu kỳ định giá và đăng ký GDBĐ.
- Output liệt kê chính xác tài liệu cần bổ sung.
- Final answer đề xuất `insufficient_data`.
- AI đề xuất nhãn **Cần bổ sung hồ sơ**; nhân viên có thể gửi lại Giám đốc sau khi bổ sung.

## Câu chốt khi trình bày

AI không phê duyệt khoản vay. Workflow harness thu thập bốn góc nhìn độc lập; RAG cung cấp căn cứ có nguồn; Planner tổng hợp; nhân viên chịu trách nhiệm gắn nhãn và trình; Giám đốc là người quyết định trong hạn mức.
