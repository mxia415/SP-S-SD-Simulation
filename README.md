# GL-3DPRT-SP/S 全路径动力学模拟

双击 `index.html` 即可离线运行，也可通过任意静态 HTTP 服务打开。

数据由 `scripts/build-dynamics-animation.py` 从正式 nominal jerk 全路径 CSV 生成；公共数据与四种 IK 元数据写入 `data.js`；各算法、各工况时程分别写入带内容哈希的 `chunks/<algorithm>-<scenario>.<hash>.js`，网页仅在需要时加载，以缩短首屏等待并满足 Cloudflare Pages 的 25 MiB 单文件限制。
页面启动后仅按 `scenarioAssets` 映射加载默认疑似IK / XY 200、Z 50 mm/s 数据块；切换算法或 TCP 工况时再加载相应数据块。
正式图层为四种 IK 在当前参数模型下的共同可达交集；58点资料仅记录为 `unverified_reference`，不参与路径或正式图层。
动力学已纳入五支电缸共 313.5 kg：Arm1 2×68.5 kg、Arm2 2×65.5 kg、Arm3 1×45.5 kg；当前以随安装销中点变化的点质量建模，真实质心随行程变化与本体惯量仍待厂家数据。
高位不相连可行区间单独标为“隔离区间”；路径只沿与底层连续相通的分量上升，不跨越空洞。
算法下拉包含局部贪心、平衡姿态、强姿态及疑似IK；疑似IK严格保留固定符号分支、200 mm投影宽度且不回退其他IK。四者均命中同一共同交集 TCP 路径并使用相同当前参数口径。
疑似IK是 Moli-SP2 静态证据恢复与 SP/S 几何覆盖组成的 Level-D hybrid；部署零偏、物理轴映射和完整控制时序仍未知，不能称为原控制器完整IK。
详细数值和原因说明见 `algorithm-comparison.md`，对比图见 `algorithm-comparison.png`。
电机扭矩为 η=1 的最不利单电机轴等效需求理论下限；不是厂家最终选型扭矩。
新硬件额定/最大转矩来自用户提供的厂家表；额定转矩虚线为 6.36/6.36/4.90 N·m。最大转矩只作低速短时边界记录，不与6000 rpm组合使用。
新硬件η=1理论额定推力为59.942/59.942/30.788 kN，实际电缸持续推力、综合效率和结构限值仍为 unknown_pending_supplier_data。
右侧扭矩纵轴按当前IK、TCP工况和臂自适应，并为新旧两组硬件保持同一量程；电缸线速度仍全局固定为 -130～130 mm/s。

## 生成校验

- 局部贪心 · XY / Z 150 mm/s: samples=22299, duration=1085.1860s, cylinder speed peaks=79.848,54.366,81.748 mm/s
-   旧: eta=1 motor torque peaks=24.313,17.362,3.159 Nm
-   新: eta=1 motor torque peaks=25.934,18.519,3.159 Nm
- 局部贪心 · XY / Z 200 mm/s: samples=17091, duration=827.4700s, cylinder speed peaks=99.818,67.290,104.097 mm/s
-   旧: eta=1 motor torque peaks=46.104,32.567,5.598 Nm
-   新: eta=1 motor torque peaks=49.178,34.738,5.598 Nm
- 局部贪心 · XY 200 / Z 50 mm/s: samples=18865, duration=918.0754s, cylinder speed peaks=99.818,61.629,104.097 mm/s
-   旧: eta=1 motor torque peaks=46.104,32.567,5.598 Nm
-   新: eta=1 motor torque peaks=49.178,34.738,5.598 Nm
- 平衡姿态 · XY / Z 150 mm/s: samples=22299, duration=1085.1860s, cylinder speed peaks=76.029,44.717,76.447 mm/s
-   旧: eta=1 motor torque peaks=13.357,7.760,1.263 Nm
-   新: eta=1 motor torque peaks=14.248,8.278,1.263 Nm
- 平衡姿态 · XY / Z 200 mm/s: samples=17091, duration=827.4700s, cylinder speed peaks=52.965,56.710,72.082 mm/s
-   旧: eta=1 motor torque peaks=13.635,7.925,1.244 Nm
-   新: eta=1 motor torque peaks=14.544,8.453,1.244 Nm
- 平衡姿态 · XY 200 / Z 50 mm/s: samples=18865, duration=918.0754s, cylinder speed peaks=52.965,56.710,72.082 mm/s
-   旧: eta=1 motor torque peaks=13.635,7.925,1.242 Nm
-   新: eta=1 motor torque peaks=14.544,8.453,1.242 Nm
- 强姿态 · XY / Z 150 mm/s: samples=22299, duration=1085.1860s, cylinder speed peaks=69.470,62.527,80.899 mm/s
-   旧: eta=1 motor torque peaks=17.828,9.516,1.306 Nm
-   新: eta=1 motor torque peaks=19.017,10.150,1.306 Nm
- 强姿态 · XY / Z 200 mm/s: samples=17091, duration=827.4700s, cylinder speed peaks=87.272,66.143,102.774 mm/s
-   旧: eta=1 motor torque peaks=33.784,17.476,2.336 Nm
-   新: eta=1 motor torque peaks=36.037,18.641,2.336 Nm
- 强姿态 · XY 200 / Z 50 mm/s: samples=18865, duration=918.0754s, cylinder speed peaks=87.272,66.143,102.774 mm/s
-   旧: eta=1 motor torque peaks=33.784,17.476,2.336 Nm
-   新: eta=1 motor torque peaks=36.037,18.641,2.336 Nm
- 疑似IK · XY / Z 150 mm/s: samples=22299, duration=1085.1860s, cylinder speed peaks=31.429,104.265,35.981 mm/s
-   旧: eta=1 motor torque peaks=1.974,2.306,1.525 Nm
-   新: eta=1 motor torque peaks=2.106,2.460,1.525 Nm
- 疑似IK · XY / Z 200 mm/s: samples=17091, duration=827.4700s, cylinder speed peaks=41.971,110.310,47.670 mm/s
-   旧: eta=1 motor torque peaks=2.003,2.339,1.567 Nm
-   新: eta=1 motor torque peaks=2.136,2.495,1.567 Nm
- 疑似IK · XY 200 / Z 50 mm/s: samples=18865, duration=918.0754s, cylinder speed peaks=41.971,110.310,47.670 mm/s
-   旧: eta=1 motor torque peaks=2.003,2.288,1.466 Nm
-   新: eta=1 motor torque peaks=2.136,2.440,1.466 Nm
