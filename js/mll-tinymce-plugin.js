(function($) {
    var that = null;
    var context = null;
    tinymce.create('tinymce.plugins.mll_plugin', {
        init: function(editor, url) {
            that = this;
            that.editor = editor;
            that.lastResult = [];
            that.curDir = null;
            
            editor.addButton('mll_button', {
                title: "Media Linked Library", // Tool tip
                image: MLL_PLUGIN_URL + 'img/' + MLL_TOOLBAR_BUTTON, // Image button
                cmd: 'mll_command' // command
            });

            editor.addCommand('mll_command', function() {
                var ts = new Date().getTime();
                editor.windowManager.open(
                    {
                        title: "Media Linked Library v" + MLL_VERSION,   //    The title of the dialog window.
                        file:  url + '/mll-tinymce-dialog.html?' + ts,      //    The HTML file with the dialog contents.
                        width: 900,                               //    The width of the dialog
                        height: 550,                              //    The height of the dialog
                        inline: 1                                 //    Whether to use modal dialog instead of separate browser window.
                    }
                );
            });
      
            editor.on('DblClick', function(f) {
                if (f.target.nodeName == "IMG" && that.editor.dom.hasClass(f.target, "media_reference")) {
                    that.editor.execCommand("mll_command");
                } 
            });

            editor.on('ExecCommand', function(ed) {
                console.log(ed.command);
                var allowed = {wpAlignNone: '', JustifyLeft: 'alignleft', JustifyCenter: 'aligncenter', JustifyRight: 'alignright'};

                var img = that.editor.dom.select('img')[0];
                if(img !== null && jQuery(img).hasClass("media_reference") && allowed.hasOwnProperty(ed.command) ) {

                    var params = that.getShortcodeParams(img.title);                   
                    params['class'] = allowed[ed.command];

                    var s = that.buildShortcode(params.id, params);
                    img.title = s.substring(1, s.length - 1);
                }
            });


            editor.on('ObjectResized', function(e) {
                if(e.target.nodeName == "IMG" && tinymce.activeEditor.dom.hasClass(e.target, "media_reference")) {
                    
                    var params = that.getShortcodeParams(e.target.title);
                    
                    params['height'] = img.height;
                    params['width'] = img.width;
                    
                    var s = that.buildShortcode(params.id, params);
                    e.target.title = s.substring(1, s.length - 1);
                }
                    
            });
            
            editor.on('BeforeSetContent', function(e){
                e.content = that._do_emb(e.content)
            });
                     
            editor.on('PostProcess', function(e){
                if (e.get) {
                    e.content = that._get_emb(e.content)
                }
            });
        },
        
        initTabs: function(){
            $("ul#tabs li", context).click(function(e){
                if (!$(this).hasClass("active")) {
                    var tabNum = $(this).index();
                    var nthChild = tabNum+1;
                    $("ul#tabs li.active", context).removeClass("active");
                    $(this).addClass("active");
                    $("ul#tab li.active", context).removeClass("active");
                    $("ul#tab li:nth-child("+nthChild+")", context).addClass("active");
                    that.onTabChanged(tabNum, context);
                }
            });

            $("ul#tabs li", context).first().trigger('click');
        },

        onTabChanged: function(index){
            $mediaContainer = $('#mediaContainer', context);
            $mediaContainer.html('');

            switch(index) {
                case 0:
                    $('#mll-noselect', context).html('<div>No Media selected yet</div>');

                    if($('#search', context).val() != '' && that.lastResult.length > 0) {
                        that.showSearchResult(that.lastResult);
                    } else {
                        $mediaContainer.append('<p style="text-align:center;">Use the search textbox and press enter to find your image</p>');
                        $mediaContainer.append('<p style="text-align:center;">You can link the image to various media files by using the "Link to Image" button</p>');
                    }
                    break;
                case 1:
                    $('#file', context).val('');
                    $('#mll-noselect', context).html('<p style="text-align:center;">Press \'Select Files\' to upload new images</p>').show();
                    that.showFolders('');
                    break;
            }
        },

        /**
         * When dialog is displayed, initialize its content
         */
        initDialog: function(ctx){
            // set the current dialog context
            context = ctx;
            that.initTabs();

            $(context).focus();
            $(context).keydown(function(e){
                if(e.which == 27) that.editor.windowManager.close();
            });
            
            var selectedNode = that.editor.selection.getNode();
            if (selectedNode.nodeName == "IMG" && that.editor.dom.hasClass(selectedNode, "media_reference")) {
                var params = that.getShortcodeParams(selectedNode.title);

                that.showMedia( params.id );
                
                that.MediaID( params.id );
                that.LinkID( params.link );
                that.LinkNewWindow( params.newwindow ),
                that.ImageWidth( params.width );
                that.ImageHeight( params.height );
            }
            
            $("form", context).submit(function(event) {
                    event.preventDefault();
                    
                    var id = that.MediaID();
                    var attr = { 
                        link: that.LinkID(),
                        newwindow: that.LinkNewWindow(),
                        width: that.ImageWidth(),
                        height: that.ImageHeight(),
                    };
                    
                    that.insertShortcode( id, attr );
            });
            
            $('#search', context).keyup(function(e){ 
                var code = e.which;
                if(code==13) {
                    e.preventDefault();
                    that.searchMedia(context);
                }
            });
            $('#search', context).change(function(e){  that.searchMedia(); });
            
            $('#category', context).change(function(){ that.searchMedia(); });
            
            $('#file', context).change(function(){
                var files = $(this)[0].files;

                var title = "<p>Selected Files</p>";
                var fileStr = '';

                for(var i = 0; i < files.length; i++){
                    fileStr += '<div>'+ files[i]['name'] +'</div>';
                }

                $('#mll-noselect', context).html(title + fileStr);
            })

            $('#btnUpload', context).click(function(){
                var files = $('#file', context)[0].files;

                $('#mediaContainer', context).html('<p style="text-align: center;font-weight:bold;">Uploading...</p>');

                that.ajax_upload_media( files, that.curDir, function(response){
                    $('#file', context).val('');
                    that.showSearchResult(response, 'mll-noselect');
                    that.showFolders(that.curDir);
                    return;
                },
                function(evt){ that.showUploadProgress(evt); }
                );
            });

            $('#btnCreateFolder', context).click(function(){
                var name = $('#newFolder', context).val();
                if(name == '') return;

                that.ajax_create_folder(name).done(function(){
                    that.showFolders(that.curDir);
                });
            });

            // load categories
            that.ajax_taxonomy_get().done(function(list){
                $.each(list, function(k, o){
                    $('#category', context).append($('<option>', {value: o.term_id, text: o.name }) );
                });
            });
        },
        
        MediaID: function(id){
            if(context == null) return 'No context found';

            if(id == undefined)
                return $("#media_id", context).val();
            else 
                $("#media_id", context).val(id);
        },
        
        LinkID: function(id){
            if(context == null) throw 'No context found';

            if(id == undefined)
                return $("#link_id", context).val();
            else
                $("#link_id", context).val(id);
        },
        
        LinkNewWindow: function(b) {
            if(context == null) throw 'No context found';

            if(b == undefined)
                return $("#link_new", context).prop('checked');
            else
                $("#link_new", context).prop('checked', b);
        },
        
        ImageWidth: function(value) {
            if(context == null) throw 'No context found';

            if(value == undefined)
                return $("#img_width", context).val();
            else
                $("#img_width", context).val(value);
        },
        
        ImageHeight: function(value) {
            if(context == null) throw 'No context found';

            if(value == undefined)
                return $("#img_height", context).val();
            else
                $("#img_height", context).val(value);
        },
        
        showSearchResult: function(data, elementId){
            if(context == null) throw 'No context found';

            var $mediaContainer = null;
            if(elementId)
                $mediaContainer = $('#' + elementId, context);
            else
                $mediaContainer = $('#mediaContainer', context);

            $mediaContainer.html('');

            $.each(data, function(i, row) {
                // original image size
                var imgSrc = row['path'];
                if(row.hasOwnProperty('thumbnail'))
                    imgSrc = row['thumbnail'];
                
                if(imgSrc === undefined)
                    imgSrc = MLL_PLUGIN_URL + 'img/' + MLL_IMAGE_NOTFOUND;
                else
                    imgSrc = MLL_UPLOAD_URL + imgSrc;

                $mediaContainer.append( that._addImage(row, imgSrc, that.showMedia, that.LinkID) );
            });
        },

        _addImage: function(data, thumbnail, onClick, onLinkClick){
            var container = $("<div />", {class: 'mll-media'});
            //var img = $('<div />', { class: 'mll-thumbnail' });
            var imgtext = $('<div />', { class: 'mll-imagetext' });
            var titletext = $('<div />');
            var mimetext = $('<p />');
            var linktext = $('<a />', { href: 'javascript:;',text: 'Link to selection' });

            //img.appendTo(container);
            imgtext.appendTo(container);

            container.css({'background': 'url('+encodeURI(thumbnail)+') no-repeat', 'background-size':'auto 80px'} );

            if(data['exists'] != undefined) data['post_title']  += " [NOT UPDATED]";

            titletext.click(function(){ onClick(data['ID']); });
            titletext.text(data['post_title']);
            titletext.appendTo(imgtext);

            mimetext.appendTo(imgtext);
            linktext.appendTo(imgtext);

            mimetext.text( data['post_mime_type']);

            linktext.click(function() { onLinkClick(data['ID']) });
            linktext.attr('title', 'ID: ' + data['ID']);
            return container;
        },
        
        searchMedia: function(){
            if(context == null) throw 'No context found';

            $('#mediaContainer', context).html('<p style="text-align: center">Loading...</p>');
            
            var search = $('#search', context).val();
            var category = parseInt($('#category', context).val());
            
            if(search.length < 3 && category <= 0) {
                $('#mediaContainer', context).html('<p style="text-align: center;color:red;">Please enter minimum 3 characters</p>');
                return;
            }
            
            that.ajax_search_media( search, $('#category', context).val() ).done(function(response){
                that.lastResult = response;
                that.showSearchResult(response);
            });
        },
        
        showMedia: function(id){
            if(context == null) throw 'No context found';

            that.MediaID(id);
            that.LinkID('');

            that.ajax_get_media(id).done(function(response){
                if(!response) {
                    $('#mll-select .mll-imagetext', context).text('Invalid media response from server');
                    return;
                }
                
                if(response['post_mime_type'].substring(0, 5) != 'image') {
                    $('#mll-select .mll-imagetext', context).html('<span style="color: red">only images supported</span>');
                    return;
                }
                                
                $('#mll-select .mll-thumbnail', context).css('background-image', 'url('+ MLL_UPLOAD_URL + encodeURI(response['path']) +')');
                $('#mll-select .mll-imagetext', context).text(response['post_title']);
                $('#mll-select',context).show();
            });
        },

        showUploadProgress: function(evt){
            if(context == null) return;

            if (evt.lengthComputable) {
                var percentComplete =evt.loaded / evt.total;

                percentComplete = parseInt(percentComplete * 100);
                
                $('#mediaContainer', context).html('<p style="text-align: center;font-weight: bold;">Uploading '+percentComplete+'%</p>');

                if (percentComplete >= 100) {
                    $('#mediaContainer', context).html('<p style="text-align: center">Upload complete<br />Please wait...</p>');
                }
            }
        },

        showFolders: function(dir){
            if(context == null) throw 'No context found';

            var $mediaContainer = $('#mediaContainer', context); 
            $mediaContainer.html('');

            that.curDir = dir;

            var parentDir = dir.replace(/\/[^\/]+$/, '');
            var currentDir = that.curDir;

            $mediaContainer.append( that._addFolder('../ [parent]', parentDir, function(path) {  that.showFolders(path);  }) );
            $mediaContainer.append( that._addFolder('./ [current]', currentDir, function(path) {  that.showFolders(path);  }) );

            that.ajax_list_dirs(dir).done(function(response){
                for(var i in response['folders']) {
                    var name = response['folders'][i];
                    
                    $mediaContainer.append( that._addFolder(name, that.curDir + name, function(path) {  that.showFolders(path);  }) );
                }

                $('#mll-noselect', context).show().html('<div>Loading...</div>');

                if(response['files'].length <= 0) {
                    $('#mll-noselect', context).html('<div>Nothing to display</div>');
                    return;
                } 

                that.ajax_get_media(response['files']).done(function(data){ 
                    that.showSearchResult(data, 'mll-noselect'); 
                });
            });

            $('#folderPath', context).text(that.curDir);
        },

        _addFolder: function(name, path, onclick) {
            var container = $("<div />", {class: 'mll-file'});
            var img = $('<div />', { class: 'mll-thumbnail' });
            var imgtext = $('<div />', { class: 'mll-imagetext' });
            imgtext.appendTo(container);

            container.data('path', path);
            container.css({ 'background': 'url('+ MLL_PLUGIN_URL + 'img/' + MLL_FOLDER_CLOSE +') no-repeat' });
            imgtext.text(name);
            imgtext.click( function() { onclick(container.data('path')); } );

            return container;
        },
               
        buildShortcode: function(id,attr){
            id = parseInt(id);
            var s = '[mediaref id=' + id;
            
            for(var key in attr){
                if(!attr.hasOwnProperty(key)) continue;
                var v = attr[key];
                if(v) s += ' ' + key + '=' + v;
            }
            s += ']';
            return s;
        },

        getShortcodeParams: function(s) {
            var reg = /([a-z]+)=(.*?)(\s|$)/g;
            var result = {};
            while ((match = reg.exec(s)) !== null) {
                result[ match[1] ] = match[2];
            }
            return result;
        },
        
        insertShortcode: function(id, attr){
            that.ajax_get_media(id).done(function(response){
                attr['path'] = encodeURI(response['path']);
                // build the shortcode with attributes (incl. relative path)
                var shortcode = that.buildShortcode(id, attr);
                
                // replace or insert the shortcode into content editor
                that.editor.execCommand('mceInsertContent', false, shortcode);
                var all_content = that.editor.getContent();
                that.editor.setContent(all_content);
                that.editor.windowManager.close();
            });
        },
        
        /**
         * receive media information by passing its attachment_id containing: [ID, post_title, relative URL path]
         * @param {integer} id the attachment ID
         */
        ajax_get_media: function(ids){
            var data = {'action': 'media_get', 'media_id': ids};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        /**
         * Ajax upload request using wordpress default action 'wp_handle_upload'
         * @param {File} f selected file from input tag
         * @param {function} callback on success returning the attachment id as parameter 1
         */
        ajax_upload_media: function(f, p, callback, progressCallback){
            var formData = new FormData();

            formData.append('action', 'wp_handle_upload');
            for(var i = 0; i < f.length; i++) {
                formData.append('file['+i+']', f[i]);
            }
            
            formData.append('path', p);
            
            jQuery.ajax({
                xhr: function(){
                    var xhr = $.ajaxSettings.xhr();
                    if($.isFunction(progressCallback)) xhr.upload.onprogress = progressCallback;
                    return xhr;
                },
                type: 'POST',
                url: ajaxurl,
                data: formData,
                cache:false,
                contentType: false,
                processData: false,
                dataType: 'json',
                success: callback
            });
        },
        
        /**
         * Ajax search request in media library
         * @param {string} filter query to search for media files
         */
        ajax_search_media: function(filter, category){
            var data = { 'action': 'media_search' };
            data['filter'] = filter;
            if(category != undefined)
                data['category'] = category;
            
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        ajax_list_dirs: function(){
            var data = {'action': 'media_list_dirs', 'dir': that.curDir};
            return jQuery.post(ajaxurl, data, null, 'json');
        },

        ajax_create_folder: function(name) {
            var data = {'action': 'media_create_folder', 'name': name, 'dir': that.curDir};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        ajax_taxonomy_get: function() {
            var data = {'action': 'taxonomy_get'};
            return jQuery.post(ajaxurl, data, null, 'json');
        },
        
        /**
         * TinyMCE: Shortcode handling to display dialog
         */
        _do_emb:function (ed) {
            return ed.replace(/\[mediaref([^\]]*)\]/g, function (d, e) {
                var imgSrc = MLL_PLUGIN_URL + "js" + MLL_IMAGE_NOTFOUND;
                
                var params = that.getShortcodeParams( e );

                if(params.path != undefined)
                    imgSrc = MLL_UPLOAD_URL + params.path;

                var result = '<img src="' + imgSrc + '" style="';
                if(params.width) result += 'width:'+ params.width +'px;';
                if(params.height) result += 'height:'+ params.height +'px;';

                result += '" class="media_reference mceItem';
                if(params.class) result += ' ' + params.class;

                result += '" title="mediaref' + tinymce.DOM.encode(e) + '" />';

                return result;
            })
        },
        
        /**
         * TinyMCE: Shortcode handling to display dialog
         */
        _get_emb:function (b) {
            function ed(c, d) {
                d = new RegExp(d + '="([^"]+)"', "g").exec(c);
                return d ? tinymce.DOM.decode(d[1]) : "";
            }
            return b.replace(/(?:<p[^>]*>)*(<img[^>]+>)(?:<\/p>)*/g, function (e, d) {
                var c = ed(d, "class");
                if (c.indexOf("media_reference") != -1) {
                    return "<p>[" + tinymce.trim(ed(d, "title")) + "]</p>"
                }
                return e
            })
        },
        
    });

    tinymce.PluginManager.add('mll_plugin', tinymce.plugins.mll_plugin);
})(jQuery);
